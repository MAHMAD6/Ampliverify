import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import type { Redis } from 'ioredis';
import { createRedis } from '../redis/redis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export type KeywordRow = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: string | null;
  intent: string | null;
  trend: number[] | null;
  /** Competitor tool only: where the domain ranks. */
  rank?: number | null;
  url?: string | null;
};

export type SerpRow = { position: number; url: string; domain: string; title: string | null; type: string };

type Item = Record<string, unknown>;

/**
 * DataForSEO (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD) normalized to the
 * internal keyword shape. Provider-specific fields never leave this class.
 */
@Injectable()
export class DataForSeoClient {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get configured() {
    return !!this.config.get('DATAFORSEO_LOGIN') && !!this.config.get('DATAFORSEO_PASSWORD');
  }

  private redisClient: Redis | null | undefined;

  /** Shared Redis cache when REDIS_URL is set. */
  private redis() {
    if (this.redisClient === undefined) {
      const url = this.config.get<string>('REDIS_URL');
      this.redisClient = url ? createRedis(url, 'dataforseo-cache') : null;
    }
    return this.redisClient;
  }

  /** DATAFORSEO_BASE_URL (default https://api.dataforseo.com/v3); only HTTPS hosts are accepted. */
  get baseUrl() {
    const v = (this.config.get<string>('DATAFORSEO_BASE_URL') ?? '').replace(/\/$/, '');
    return /^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(v) ? v : 'https://api.dataforseo.com/v3';
  }

  private location(country: string) {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase()) ?? 'United States';
  }

  private async post(path: string, task: Record<string, unknown>, operation: string): Promise<Item | null> {
    if (!this.configured) {
      throw new ServiceUnavailableException({ code: 'KEYWORD_DATA_NOT_CONFIGURED', message: 'Keyword data is not available yet.' });
    }
    const auth = Buffer.from(`${this.config.get('DATAFORSEO_LOGIN')}:${this.config.get('DATAFORSEO_PASSWORD')}`).toString('base64');
    const started = Date.now();
    let status = 'ok';
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
        body: JSON.stringify([task]),
        signal: AbortSignal.timeout(60_000),
      });
      const json = (await res.json().catch(() => ({}))) as { status_code?: number; status_message?: string; cost?: number; tasks?: { status_code?: number; status_message?: string; result?: Item[] }[] };
      const taskResult = json.tasks?.[0];
      if (!res.ok || (taskResult?.status_code ?? 0) >= 40000) {
        status = 'error';
        throw new ServiceUnavailableException({ code: 'KEYWORD_PROVIDER_ERROR', message: taskResult?.status_message ?? json.status_message ?? 'Keyword data provider error.' });
      }
      await this.prisma.providerUsage.create({
        data: { provider: 'dataforseo', operation, costMinor: json.cost !== undefined ? BigInt(Math.round(json.cost * 100)) : null, currency: 'USD' },
      });
      return taskResult?.result?.[0] ?? null;
    } catch (err) {
      if (status === 'ok') status = 'network_error';
      throw err instanceof ServiceUnavailableException ? err : new ServiceUnavailableException({ code: 'KEYWORD_PROVIDER_ERROR', message: 'Keyword data provider is unavailable.' });
    } finally {
      await this.prisma.providerEvent.create({ data: { provider: 'dataforseo', operation, status, latencyMs: Date.now() - started } }).catch(() => undefined);
    }
  }

  /** Raw task result for callers that normalize other DataForSEO endpoints (website valuation). */
  request(path: string, task: Record<string, unknown>, operation: string) {
    return this.post(path, task, operation);
  }

  /**
   * Cached live request: identical requests within `ttlHours` reuse the stored
   * result instead of paying for another call (DataForSEO summary §4).
   */
  async cachedPost(path: string, task: Record<string, unknown>, operation: string, ttlHours = 24): Promise<Item | null> {
    const key = `dfs:${createHash('sha256').update(`${path}|${JSON.stringify(task)}`).digest('hex')}`;
    // Redis first (shared, fast), PostgreSQL as the durable fallback.
    const redis = this.redis();
    if (redis) {
      const cached = await redis.get(key).catch(() => null);
      if (cached !== null) return JSON.parse(cached) as Item | null;
    }
    const hit = await this.prisma.providerCache.findUnique({ where: { key } });
    if (hit && hit.expiresAt > new Date()) {
      if (redis) await redis.set(key, JSON.stringify(hit.valueJson), 'PX', Math.max(1000, hit.expiresAt.getTime() - Date.now())).catch(() => undefined);
      return hit.valueJson as Item | null;
    }
    const result = await this.post(path, task, operation);
    if (redis) await redis.set(key, JSON.stringify(result), 'EX', ttlHours * 3600).catch(() => undefined);
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
    const value = (result ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    await this.prisma.providerCache.upsert({ where: { key }, create: { key, provider: 'dataforseo', valueJson: value, expiresAt }, update: { valueJson: value, fetchedAt: new Date(), expiresAt } }).catch(() => undefined);
    return result;
  }

  // ── On-Page API (DataForSEO summary §4): crawl + technical diagnostics ──

  /** Starts an On-Page crawl of `target` (domain) limited to `maxPages`; returns the task id. */
  onPageStart(target: string, maxPages: number) {
    return this.postTask('/on_page/task_post', { target, max_crawl_pages: Math.min(Math.max(maxPages, 1), 500), load_resources: false, enable_javascript: false, store_raw_html: false }, 'onpage.task');
  }

  /** On-Page summary; `ready` once the crawl has finished. */
  async onPageSummary(taskId: string) {
    const { task } = await this.call('GET', `/on_page/summary/${encodeURIComponent(taskId)}`, null, 'onpage.summary');
    const result = (task?.result?.[0] ?? null) as Item | null;
    const progress = result?.crawl_progress as string | undefined;
    return { ready: progress === 'finished', result };
  }

  locationName(country: string) {
    return this.location(country);
  }

  private normalize(item: Item): KeywordRow {
    const data = (item.keyword_data as Item | undefined) ?? item;
    const info = (data.keyword_info as Item | undefined) ?? {};
    const props = (data.keyword_properties as Item | undefined) ?? {};
    const intent = (data.search_intent_info as Item | undefined)?.main_intent as string | undefined;
    const monthly = (info.monthly_searches as { search_volume?: number }[] | undefined) ?? null;
    const serpItem = ((item.ranked_serp_element as Item | undefined)?.serp_item as Item | undefined) ?? undefined;
    return {
      keyword: String(data.keyword ?? ''),
      searchVolume: typeof info.search_volume === 'number' ? info.search_volume : null,
      difficulty: typeof props.keyword_difficulty === 'number' ? props.keyword_difficulty : null,
      cpc: typeof info.cpc === 'number' ? info.cpc : null,
      competition: (info.competition_level as string | undefined) ?? null,
      intent: intent ?? null,
      trend: monthly ? monthly.slice(0, 12).reverse().map((m) => m.search_volume ?? 0) : null,
      ...(serpItem ? { rank: (serpItem.rank_absolute as number | undefined) ?? null, url: (serpItem.url as string | undefined) ?? null } : {}),
    };
  }

  private items(result: Item | null) {
    return ((result?.items as Item[] | undefined) ?? []).map((i) => this.normalize(i)).filter((r) => r.keyword);
  }

  async overview(seed: string, country: string, language: string) {
    const result = await this.cachedPost('/dataforseo_labs/google/keyword_overview/live', { keywords: [seed], location_name: this.location(country), language_code: language, include_serp_info: false }, 'keywords.overview');
    return this.items(result)[0] ?? null;
  }

  async ideas(seed: string, country: string, language: string, limit = 100) {
    return this.items(await this.cachedPost('/dataforseo_labs/google/keyword_ideas/live', { keywords: [seed], location_name: this.location(country), language_code: language, limit }, 'keywords.ideas'));
  }

  async related(seed: string, country: string, language: string, limit = 100) {
    return this.items(await this.cachedPost('/dataforseo_labs/google/related_keywords/live', { keyword: seed, location_name: this.location(country), language_code: language, depth: 2, limit }, 'keywords.related'));
  }

  async suggestions(seed: string, country: string, language: string, limit = 300) {
    return this.items(await this.cachedPost('/dataforseo_labs/google/keyword_suggestions/live', { keyword: seed, location_name: this.location(country), language_code: language, limit }, 'keywords.suggestions'));
  }

  async domainKeywords(domain: string, country: string, language: string, limit = 200) {
    return this.items(await this.cachedPost('/dataforseo_labs/google/ranked_keywords/live', { target: domain, location_name: this.location(country), language_code: language, limit, order_by: ['keyword_data.keyword_info.search_volume,desc'] }, 'keywords.ranked'));
  }

  async serp(keyword: string, country: string, language: string): Promise<SerpRow[]> {
    const result = await this.cachedPost('/serp/google/organic/live/advanced', { keyword, location_name: this.location(country), language_code: language, depth: 20 }, 'serp.organic');
    return ((result?.items as Item[] | undefined) ?? [])
      .filter((i) => i.url && typeof i.rank_absolute === 'number')
      .map((i) => ({ position: i.rank_absolute as number, url: String(i.url), domain: String(i.domain ?? ''), title: (i.title as string | undefined) ?? null, type: String(i.type ?? 'organic') }));
  }

  // ── Standard (queued) task mode: task_post → task_get (V1 manual §4.1) ──

  private async call(method: 'GET' | 'POST', path: string, body: unknown, operation: string) {
    if (!this.configured) throw new ServiceUnavailableException({ code: 'DATAFORSEO_NOT_CONFIGURED', message: 'Search data is not available yet.' });
    const auth = Buffer.from(`${this.config.get('DATAFORSEO_LOGIN')}:${this.config.get('DATAFORSEO_PASSWORD')}`).toString('base64');
    const started = Date.now();
    let status = 'ok';
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { authorization: `Basic ${auth}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429 || res.status >= 500) {
        status = res.status === 429 ? 'rate_limited' : `http_${res.status}`;
        throw new TransientProviderError(`DataForSEO HTTP ${res.status}`);
      }
      const json = (await res.json().catch(() => ({}))) as { cost?: number; status_message?: string; tasks?: { id?: string; status_code?: number; status_message?: string; cost?: number; result?: Item[] | null }[] };
      if (!res.ok) {
        status = `http_${res.status}`;
        throw new ServiceUnavailableException({ code: 'DATAFORSEO_ERROR', message: json.status_message ?? 'Search data provider error.' });
      }
      if (json.cost) await this.prisma.providerUsage.create({ data: { provider: 'dataforseo', operation, costMinor: BigInt(Math.round(json.cost * 100)), currency: 'USD' } });
      return { task: json.tasks?.[0], cost: json.cost ?? 0 };
    } catch (err) {
      if (status === 'ok') status = 'network_error';
      if (err instanceof TransientProviderError || err instanceof ServiceUnavailableException) throw err;
      throw new TransientProviderError(err instanceof Error ? err.message : String(err));
    } finally {
      await this.prisma.providerEvent.create({ data: { provider: 'dataforseo', operation, status, latencyMs: Date.now() - started } }).catch(() => undefined);
    }
  }

  /** Creates a queued task; returns the provider task id. */
  async postTask(path: string, task: Record<string, unknown>, operation: string) {
    const { task: t, cost } = await this.call('POST', path, [task], operation);
    if (!t?.id || (t.status_code ?? 0) >= 40000) throw new ServiceUnavailableException({ code: 'DATAFORSEO_TASK_REJECTED', message: t?.status_message ?? 'The search task was rejected.' });
    return { id: t.id, cost };
  }

  /** Reads a queued task; `ready` is false while DataForSEO is still processing it (40601/40602). */
  async getTask(path: string, operation: string) {
    const { task: t } = await this.call('GET', path, null, operation);
    const code = t?.status_code ?? 0;
    if (code === 40601 || code === 40602) return { ready: false as const, result: null, cost: 0 };
    if (code >= 40000) throw new ServiceUnavailableException({ code: 'DATAFORSEO_TASK_FAILED', message: t?.status_message ?? 'The search task failed.' });
    return { ready: true as const, result: t?.result?.[0] ?? null, cost: t?.cost ?? 0 };
  }
}

/** Throttling, 5xx and network failures: safe to retry with backoff. */
export class TransientProviderError extends Error {}
