import { BadRequestException, Global, Injectable, Module, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { promises as dns } from 'dns';
import { isBlockedAddress, parsePublicUrl } from '../common/utils/safe-fetch';
import { PrismaService } from '../prisma/prisma.service';

export type Strategy = 'mobile' | 'desktop';
export const PSI_CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'] as const;

export type PageSpeedResult = {
  analyzedUrl: string;
  strategy: Strategy;
  fetchedAt: string;
  /** 0–100 per Lighthouse category; null when Lighthouse did not score it. */
  scores: Record<(typeof PSI_CATEGORIES)[number], number | null>;
  /** CrUX field data (when Google has it) — FAST / AVERAGE / SLOW. */
  fieldData: string | null;
  metrics: Record<string, string | null>;
  /** Failing Lighthouse audits (performance + SEO), most important first. */
  opportunities: { id: string; title: string; score: number | null; displayValue: string | null; category: string }[];
  cached: boolean;
};

type Item = Record<string, unknown>;

/**
 * Google PageSpeed Insights v5 (Google manual §6.3): server-side key
 * (GOOGLE_PAGESPEED_API_KEY or PAGESPEED_API_KEY), public URLs only, results
 * cached ~24h by URL, device and categories. Failures are reported as such —
 * no score is ever invented. PageSpeed checks one URL; it is not a crawler.
 */
@Injectable()
export class PageSpeedService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get apiKey() {
    return this.config.get<string>('GOOGLE_PAGESPEED_API_KEY') || this.config.get<string>('PAGESPEED_API_KEY') || undefined;
  }

  private async assertPublic(raw: string) {
    let url: URL;
    try {
      url = parsePublicUrl(raw);
    } catch {
      throw new BadRequestException({ code: 'UNSUPPORTED_URL', message: 'PageSpeed can only analyze public http(s) pages.' });
    }
    if (this.config.get('AUDIT_ALLOW_PRIVATE_HOSTS') === 'true') return url;
    const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => []);
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      throw new BadRequestException({ code: 'UNSUPPORTED_URL', message: 'PageSpeed can only analyze public websites.' });
    }
    return url;
  }

  async run(rawUrl: string, strategy: Strategy, opts: { maxAgeHours?: number } = {}): Promise<PageSpeedResult> {
    const url = await this.assertPublic(rawUrl);
    const key = `psi:${strategy}:${createHash('sha256').update(`${url.toString()}|${PSI_CATEGORIES.join(',')}`).digest('hex')}`;
    const hit = await this.prisma.providerCache.findUnique({ where: { key } });
    if (hit && hit.expiresAt > new Date()) return { ...(hit.valueJson as unknown as PageSpeedResult), cached: true };

    const q = new URLSearchParams({ url: url.toString(), strategy });
    for (const c of PSI_CATEGORIES) q.append('category', c);
    if (this.apiKey) q.set('key', this.apiKey);
    const started = Date.now();
    let status = 'ok';
    try {
      const res = await fetch(`https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(120_000) }).catch(() => null);
      if (!res) {
        status = 'timeout';
        throw new ServiceUnavailableException({ code: 'PAGESPEED_FAILED', message: 'Performance analysis could not be completed.' });
      }
      if (!res.ok) {
        status = `http_${res.status}`;
        throw new ServiceUnavailableException({ code: res.status === 429 ? 'PAGESPEED_QUOTA' : 'PAGESPEED_FAILED', message: 'Performance analysis could not be completed.' });
      }
      const data = (await res.json()) as Item;
      const result = this.normalize(data, strategy);
      const expiresAt = new Date(Date.now() + (opts.maxAgeHours ?? 24) * 3600_000);
      await this.prisma.providerCache.upsert({ where: { key }, create: { key, provider: 'pagespeed', valueJson: result as unknown as Prisma.InputJsonObject, expiresAt }, update: { valueJson: result as unknown as Prisma.InputJsonObject, fetchedAt: new Date(), expiresAt } });
      return result;
    } finally {
      await this.prisma.providerEvent.create({ data: { provider: 'pagespeed', operation: `psi.${strategy}`, status, latencyMs: Date.now() - started } }).catch(() => undefined);
    }
  }

  private normalize(data: Item, strategy: Strategy): PageSpeedResult {
    const lh = (data.lighthouseResult ?? {}) as Item;
    const cats = (lh.categories ?? {}) as Record<string, { score?: number | null; auditRefs?: { id: string; weight?: number }[] }>;
    const audits = (lh.audits ?? {}) as Record<string, { title?: string; score?: number | null; displayValue?: string; scoreDisplayMode?: string }>;
    const score = (c: string) => (typeof cats[c]?.score === 'number' ? Math.round((cats[c].score as number) * 100) : null);
    const opportunities: PageSpeedResult['opportunities'] = [];
    for (const cat of ['performance', 'seo'] as const) {
      for (const ref of [...(cats[cat]?.auditRefs ?? [])].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))) {
        const a = audits[ref.id];
        if (!a || a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'informative' || a.score === null || a.score === undefined || a.score >= 0.9) continue;
        opportunities.push({ id: ref.id, title: a.title ?? ref.id, score: a.score, displayValue: a.displayValue ?? null, category: cat });
      }
    }
    const metric = (id: string) => audits[id]?.displayValue ?? null;
    const field = ((data.loadingExperience as Item | undefined)?.overall_category ?? (data.originLoadingExperience as Item | undefined)?.overall_category) as string | undefined;
    return {
      analyzedUrl: String(data.id ?? lh.finalUrl ?? ''),
      strategy,
      fetchedAt: String(data.analysisUTCTimestamp ?? lh.fetchTime ?? new Date().toISOString()),
      scores: { performance: score('performance'), seo: score('seo'), accessibility: score('accessibility'), 'best-practices': score('best-practices') },
      fieldData: field ?? null,
      metrics: { lcp: metric('largest-contentful-paint'), cls: metric('cumulative-layout-shift'), tbt: metric('total-blocking-time'), fcp: metric('first-contentful-paint'), si: metric('speed-index') },
      opportunities: opportunities.slice(0, 15),
      cached: false,
    };
  }
}

@Global()
@Module({ providers: [PageSpeedService], exports: [PageSpeedService] })
export class PageSpeedModule {}
