import { Injectable, ServiceUnavailableException } from '@nestjs/common';
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
      const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
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
    const result = await this.post('/dataforseo_labs/google/keyword_overview/live', { keywords: [seed], location_name: this.location(country), language_code: language, include_serp_info: false }, 'keywords.overview');
    return this.items(result)[0] ?? null;
  }

  async ideas(seed: string, country: string, language: string, limit = 100) {
    return this.items(await this.post('/dataforseo_labs/google/keyword_ideas/live', { keywords: [seed], location_name: this.location(country), language_code: language, limit }, 'keywords.ideas'));
  }

  async related(seed: string, country: string, language: string, limit = 100) {
    return this.items(await this.post('/dataforseo_labs/google/related_keywords/live', { keyword: seed, location_name: this.location(country), language_code: language, depth: 2, limit }, 'keywords.related'));
  }

  async suggestions(seed: string, country: string, language: string, limit = 300) {
    return this.items(await this.post('/dataforseo_labs/google/keyword_suggestions/live', { keyword: seed, location_name: this.location(country), language_code: language, limit }, 'keywords.suggestions'));
  }

  async domainKeywords(domain: string, country: string, language: string, limit = 200) {
    return this.items(await this.post('/dataforseo_labs/google/ranked_keywords/live', { target: domain, location_name: this.location(country), language_code: language, limit, order_by: ['keyword_data.keyword_info.search_volume,desc'] }, 'keywords.ranked'));
  }

  async serp(keyword: string, country: string, language: string): Promise<SerpRow[]> {
    const result = await this.post('/serp/google/organic/live/advanced', { keyword, location_name: this.location(country), language_code: language, depth: 20 }, 'serp.organic');
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
      const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
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
