import { DataForSeoClient } from '../keywords/dataforseo.client';
import { safeFetch } from '../common/utils/safe-fetch';
import { periodChange, Signals, SourceKey, SourceState } from './valuation-engine';

type Item = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export type TrendPoint = { month: string; value: number };

/** Everything collected for one domain, plus per-source status and trends for the report. */
export type Collected = {
  signals: Signals;
  sources: Record<SourceKey, SourceState>;
  sourceNotes: Partial<Record<SourceKey, string>>;
  trends: { organicTraffic: TrendPoint[]; referringDomains: TrendPoint[]; rankingKeywords: TrendPoint[]; socialTraffic: TrendPoint[] };
  socialSources: { source: string; visits: number; share: number }[];
  domain: { registeredAt: string | null; status: string | null; tld: string };
  screenshot: string | null;
  technical: { crawlable: boolean | null; indexable: boolean | null; mobileFriendly: boolean | null; https: boolean | null };
  totalBacklinks: number | null;
};

export function emptySignals(domain: string): Signals {
  return {
    organicVisits: null,
    organicTrafficValue: null,
    rankingKeywords: null,
    avgPosition: null,
    referringDomains: null,
    backlinks: null,
    domainAuthority: null,
    contentPages: null,
    pagespeedMobile: null,
    pagespeedDesktop: null,
    coreWebVitals: null,
    https: null,
    crawlable: null,
    indexable: null,
    domainAgeYears: null,
    tld: domain.split('.').pop() ?? '',
    brandShare: null,
    avgKeywordDifficulty: null,
    socialVisits: null,
    totalVisits: null,
    trafficGrowthPct: null,
    backlinkGrowthPct: null,
    verifiedOrganicVisits: null,
  };
}

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

/** DataForSEO Labs + Backlinks: traffic, keywords, history, authority. Each call fails independently. */
export async function collectDataForSeo(client: DataForSeoClient, domain: string, country: string, language: string, out: Collected, notes: string[]) {
  const location_name = client.locationName(country);
  let any = false;
  try {
    const r = await client.request('/dataforseo_labs/google/domain_rank_overview/live', { target: domain, location_name, language_code: language }, 'valuation.rank_overview');
    const organic = (((r?.items as Item[] | undefined)?.[0]?.metrics as Item | undefined)?.organic as Item | undefined) ?? null;
    if (organic) {
      any = true;
      out.signals.organicVisits = Math.round(num(organic.etv) ?? 0);
      out.signals.organicTrafficValue = num(organic.estimated_paid_traffic_cost);
      out.signals.rankingKeywords = num(organic.count);
      const buckets: [string, number][] = [['pos_1', 1], ['pos_2_3', 2.5], ['pos_4_10', 7], ['pos_11_20', 15.5], ['pos_21_30', 25.5], ['pos_31_40', 35.5], ['pos_41_50', 45.5], ['pos_51_60', 55.5], ['pos_61_70', 65.5], ['pos_71_80', 75.5], ['pos_81_90', 85.5], ['pos_91_100', 95.5]];
      const counted = buckets.map(([k, mid]) => [num(organic[k]) ?? 0, mid] as const);
      const total = counted.reduce((t, [c]) => t + c, 0);
      out.signals.avgPosition = total ? Math.round((counted.reduce((t, [c, mid]) => t + c * mid, 0) / total) * 10) / 10 : null;
    } else {
      out.signals.organicVisits = 0;
      out.signals.rankingKeywords = 0;
    }
  } catch (e) {
    notes.push(`Traffic: ${(e as Error).message}`);
  }
  try {
    const r = await client.request('/dataforseo_labs/google/historical_rank_overview/live', { target: domain, location_name, language_code: language }, 'valuation.rank_history');
    const items = ((r?.items as Item[] | undefined) ?? [])
      .map((i) => ({ month: monthKey(Number(i.year), Number(i.month)), organic: ((i.metrics as Item | undefined)?.organic as Item | undefined) ?? {} }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
    out.trends.organicTraffic = items.map((i) => ({ month: i.month, value: Math.round(num(i.organic.etv) ?? 0) }));
    out.trends.rankingKeywords = items.map((i) => ({ month: i.month, value: num(i.organic.count) ?? 0 }));
    out.signals.trafficGrowthPct = periodChange(out.trends.organicTraffic.map((p) => p.value));
  } catch (e) {
    notes.push(`Traffic history: ${(e as Error).message}`);
  }
  try {
    const kws = await client.domainKeywords(domain, country, language, 100);
    const label = domain.split('.')[0].replace(/-/g, ' ').toLowerCase();
    const volume = kws.reduce((t, k) => t + (k.searchVolume ?? 0), 0);
    const brand = kws.filter((k) => k.keyword.toLowerCase().replace(/-/g, ' ').includes(label)).reduce((t, k) => t + (k.searchVolume ?? 0), 0);
    out.signals.brandShare = volume ? brand / volume : null;
    const kd = kws.map((k) => k.difficulty).filter((d): d is number => d !== null);
    out.signals.avgKeywordDifficulty = kd.length ? kd.reduce((a, b) => a + b, 0) / kd.length : null;
  } catch (e) {
    notes.push(`Keywords: ${(e as Error).message}`);
  }
  try {
    const r = await client.request('/backlinks/summary/live', { target: domain, include_subdomains: true }, 'valuation.backlinks_summary');
    if (r) {
      any = true;
      out.signals.referringDomains = num(r.referring_domains);
      out.signals.backlinks = num(r.backlinks);
      out.totalBacklinks = num(r.backlinks);
      const rank = num(r.rank);
      out.signals.domainAuthority = rank === null ? null : Math.round(rank / 10);
    }
  } catch (e) {
    notes.push(`Backlinks: ${(e as Error).message}`);
  }
  try {
    const from = new Date(Date.UTC(new Date().getUTCFullYear() - 1, new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
    const r = await client.request('/backlinks/history/live', { target: domain, date_from: from }, 'valuation.backlinks_history');
    out.trends.referringDomains = ((r?.items as Item[] | undefined) ?? [])
      .map((i) => ({ month: String(i.date ?? '').slice(0, 7), value: num(i.referring_domains) ?? 0 }))
      .filter((p) => p.month)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
    out.signals.backlinkGrowthPct = periodChange(out.trends.referringDomains.map((p) => p.value));
  } catch (e) {
    notes.push(`Backlink history: ${(e as Error).message}`);
  }
  return any;
}

/** PageSpeed Insights (mobile + desktop): performance, Core Web Vitals, screenshot. */
export async function collectPageSpeed(domain: string, apiKey: string | undefined, out: Collected) {
  const run = async (strategy: 'mobile' | 'desktop') => {
    const q = new URLSearchParams({ url: `https://${domain}/`, strategy, category: 'performance' });
    if (apiKey) q.set('key', apiKey);
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`PageSpeed Insights returned ${res.status}.`);
    return (await res.json()) as Item;
  };
  const [mobile, desktop] = await Promise.allSettled([run('mobile'), run('desktop')]);
  const score = (r: PromiseSettledResult<Item>) => {
    if (r.status !== 'fulfilled') return null;
    const s = num((((r.value.lighthouseResult as Item | undefined)?.categories as Item | undefined)?.performance as Item | undefined)?.score);
    return s === null ? null : Math.round(s * 100);
  };
  out.signals.pagespeedMobile = score(mobile);
  out.signals.pagespeedDesktop = score(desktop);
  if (mobile.status === 'fulfilled') {
    const cat = (mobile.value.loadingExperience as Item | undefined)?.overall_category ?? (mobile.value.originLoadingExperience as Item | undefined)?.overall_category;
    out.signals.coreWebVitals = cat === 'FAST' ? 'good' : cat === 'AVERAGE' ? 'needs_improvement' : cat === 'SLOW' ? 'poor' : null;
    const shot = ((((mobile.value.lighthouseResult as Item | undefined)?.audits as Item | undefined)?.['final-screenshot'] as Item | undefined)?.details as Item | undefined)?.data;
    if (typeof shot === 'string' && shot.startsWith('data:image/') && shot.length < 400_000) out.screenshot = shot;
    const viewport = (((mobile.value.lighthouseResult as Item | undefined)?.audits as Item | undefined)?.viewport as Item | undefined)?.score;
    out.technical.mobileFriendly = viewport === undefined ? null : viewport === 1;
  }
  if (out.signals.pagespeedMobile === null && out.signals.pagespeedDesktop === null) {
    throw new Error(mobile.status === 'rejected' ? String((mobile.reason as Error).message) : 'No PageSpeed data.');
  }
}

/** RDAP registration data (domain age, status). Tries the registrable domain. */
export async function collectRdap(domain: string, out: Collected) {
  const labels = domain.split('.');
  const candidates = [domain, labels.slice(-2).join('.'), labels.slice(-3).join('.')].filter((d, i, a) => d.includes('.') && a.indexOf(d) === i);
  for (const d of candidates) {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(d)}`, { headers: { accept: 'application/rdap+json' }, signal: AbortSignal.timeout(20_000), redirect: 'follow' }).catch(() => null);
    if (!res?.ok) continue;
    const json = (await res.json().catch(() => null)) as { events?: { eventAction?: string; eventDate?: string }[]; status?: string[] } | null;
    const reg = json?.events?.find((e) => e.eventAction === 'registration')?.eventDate;
    if (reg) {
      out.domain.registeredAt = reg;
      out.signals.domainAgeYears = Math.max(0, Math.round(((Date.now() - new Date(reg).getTime()) / (365.25 * 86400000)) * 10) / 10);
    }
    out.domain.status = json?.status?.some((s) => /active|ok/i.test(s)) ? 'Active' : (json?.status?.[0] ?? null);
    return;
  }
  throw new Error('No RDAP record found.');
}

/** True when robots.txt disallows the whole site for all crawlers (`User-agent: *` + `Disallow: /`). */
export function blocksEverything(robots: string) {
  let inStar = false;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [key, value] = [m[1].toLowerCase(), m[2].trim()];
    if (key === 'user-agent') {
      inStar = lastWasAgent ? inStar || value === '*' : value === '*';
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (inStar && key === 'disallow' && value === '/') return true;
  }
  return false;
}

/** Homepage, robots.txt and sitemap checks through the SSRF-safe fetcher. */
export async function collectSite(domain: string, allowPrivate: boolean, out: Collected) {
  const home = await safeFetch(`https://${domain}/`, { timeoutMs: 20_000, maxBytes: 2_000_000, allowPrivate }).catch(() => null);
  out.signals.https = home ? home.finalUrl.startsWith('https://') && home.status < 400 : false;
  out.technical.https = out.signals.https;
  if (home) {
    const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(home.body) || /noindex/i.test(home.headers['x-robots-tag'] ?? '');
    out.signals.indexable = home.status < 400 && !noindex;
  }
  const robots = await safeFetch(`https://${domain}/robots.txt`, { timeoutMs: 15_000, maxBytes: 500_000, allowPrivate }).catch(() => null);
  const robotsBody = robots && robots.status < 400 ? robots.body : '';
  out.signals.crawlable = home ? !blocksEverything(robotsBody) : null;
  out.technical.crawlable = out.signals.crawlable;
  out.technical.indexable = out.signals.indexable;

  // Count URLs in the sitemap(s): robots.txt Sitemap lines, else /sitemap.xml. Follows one level of index files.
  const listed = [...robotsBody.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 5);
  const queue = listed.length ? listed : [`https://${domain}/sitemap.xml`];
  let pages = 0;
  let fetched = 0;
  const seen = new Set<string>();
  while (queue.length && fetched < 12 && pages < 200_000) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await safeFetch(url, { timeoutMs: 20_000, maxBytes: 20_000_000, allowPrivate }).catch(() => null);
    fetched++;
    if (!r || r.status >= 400) continue;
    if (/<sitemapindex/i.test(r.body)) {
      for (const m of r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) queue.push(m[1]);
    } else {
      pages += (r.body.match(/<url>/gi) ?? []).length;
    }
  }
  out.signals.contentPages = pages > 0 ? pages : null;
}

export function initialCollected(domain: string, enabled: Record<SourceKey, boolean>): Collected {
  const sources = {} as Record<SourceKey, SourceState>;
  for (const k of Object.keys(enabled) as SourceKey[]) sources[k] = enabled[k] ? 'unavailable' : 'disabled';
  return {
    signals: emptySignals(domain),
    sources,
    sourceNotes: {},
    trends: { organicTraffic: [], referringDomains: [], rankingKeywords: [], socialTraffic: [] },
    socialSources: [],
    domain: { registeredAt: null, status: null, tld: domain.split('.').pop() ?? '' },
    screenshot: null,
    technical: { crawlable: null, indexable: null, mobileFriendly: null, https: null },
    totalBacklinks: null,
  };
}
