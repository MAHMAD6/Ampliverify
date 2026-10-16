import { DataForSeoClient } from '../keywords/dataforseo.client';
import { safeFetch } from '../common/utils/safe-fetch';
import { Evidence, SOURCE_CLASS, SourceKey } from './valuation-engine';

type Item = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const now = () => new Date().toISOString();

export type TrendPoint = { month: string; value: number };

/** Collected evidence plus display-only extras (trend chart, screenshot). */
export type Collected = {
  evidence: Evidence[];
  trends: { organicVisibility: TrendPoint[] };
  screenshot: string | null;
};

export function ev(source: SourceKey, metric: string, label: string, value: Evidence['value'], opts: Partial<Evidence> = {}): Evidence {
  return { source, metric: `${source}.${metric}`, label, value, classification: SOURCE_CLASS[source], status: value === null ? 'unavailable' : 'available', observedAt: now(), ...opts };
}

/** Marks every metric a source would have produced as unavailable, with the reason. */
export function missing(source: SourceKey, metrics: [string, string][], reason: string): Evidence[] {
  return metrics.map(([m, l]) => ev(source, m, l, null, { status: 'unavailable', missingReason: reason }));
}

export const CRAWLER_METRICS: [string, string][] = [
  ['http_ok', 'Home page responds'],
  ['https', 'HTTPS'],
  ['redirect_hops', 'Redirect hops'],
  ['indexable', 'Home page indexable'],
  ['crawlable', 'Not blocked by robots.txt'],
  ['title_length', 'Title length'],
  ['meta_description_length', 'Meta description length'],
  ['h1_count', 'H1 headings'],
  ['h2_count', 'H2 headings'],
  ['canonical_valid', 'Canonical URL valid'],
  ['structured_data', 'Structured data present'],
  ['word_count', 'Home page word count'],
  ['sitemap_urls', 'URLs in sitemap'],
];
export const PAGESPEED_METRICS: [string, string][] = [
  ['performance_mobile', 'Performance (mobile)'],
  ['performance_desktop', 'Performance (desktop)'],
  ['core_web_vitals', 'Core Web Vitals (field data)'],
];
export const RDAP_METRICS: [string, string][] = [
  ['domain_age_years', 'Domain age'],
  ['status', 'Registration status'],
  ['registered_at', 'Registration date'],
];
export const DATAFORSEO_METRICS: [string, string][] = [
  ['estimated_organic_visits', 'Estimated organic visits / month'],
  ['ranking_keywords', 'Ranking keywords'],
  ['avg_position', 'Average ranking position'],
];

/** Internal crawler (direct website observations), through the SSRF-safe fetcher. */
export async function collectCrawler(domain: string, allowPrivate: boolean): Promise<Evidence[]> {
  const out: Evidence[] = [];
  const home = await safeFetch(`https://${domain}/`, { timeoutMs: 20_000, maxBytes: 3_000_000, allowPrivate }).catch((e: Error) => e);
  if (home instanceof Error) return missing('crawler', CRAWLER_METRICS, `Home page could not be fetched: ${home.message}`);
  const html = home.body;
  const tag = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
  const title = tag(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = tag(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ?? tag(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const canonical = tag(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  let canonicalValid: boolean | null = null;
  if (canonical) {
    try {
      const c = new URL(canonical, home.finalUrl);
      canonicalValid = c.hostname.replace(/^www\./, '') === new URL(home.finalUrl).hostname.replace(/^www\./, '') && c.protocol === 'https:';
    } catch {
      canonicalValid = false;
    }
  } else canonicalValid = false;
  const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html) || /noindex/i.test(home.headers['x-robots-tag'] ?? '');
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w)).length;
  out.push(
    ev('crawler', 'http_ok', 'Home page responds', home.status < 400, { unit: `HTTP ${home.status}` }),
    ev('crawler', 'https', 'HTTPS', home.finalUrl.startsWith('https://')),
    ev('crawler', 'redirect_hops', 'Redirect hops', home.redirects.length),
    ev('crawler', 'indexable', 'Home page indexable', home.status < 400 && !noindex),
    ev('crawler', 'title_length', 'Title length', title === null ? 0 : title.length, { unit: 'characters' }),
    ev('crawler', 'meta_description_length', 'Meta description length', desc === null ? 0 : desc.length, { unit: 'characters' }),
    ev('crawler', 'h1_count', 'H1 headings', (html.match(/<h1[\s>]/gi) ?? []).length),
    ev('crawler', 'h2_count', 'H2 headings', (html.match(/<h2[\s>]/gi) ?? []).length),
    ev('crawler', 'canonical_valid', 'Canonical URL valid', canonicalValid),
    ev('crawler', 'structured_data', 'Structured data present', /application\/ld\+json/i.test(html) || /itemscope/i.test(html)),
    ev('crawler', 'word_count', 'Home page word count', words),
  );
  const robots = await safeFetch(`https://${domain}/robots.txt`, { timeoutMs: 15_000, maxBytes: 500_000, allowPrivate }).catch(() => null);
  const robotsBody = robots && robots.status < 400 ? robots.body : '';
  out.push(ev('crawler', 'crawlable', 'Not blocked by robots.txt', !blocksEverything(robotsBody)));
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
    if (/<sitemapindex/i.test(r.body)) for (const m of r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) queue.push(m[1]);
    else pages += (r.body.match(/<url>/gi) ?? []).length;
  }
  out.push(pages > 0 ? ev('crawler', 'sitemap_urls', 'URLs in sitemap', pages) : ev('crawler', 'sitemap_urls', 'URLs in sitemap', null, { missingReason: 'No readable XML sitemap was found.' }));
  return out;
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

/** PageSpeed Insights v5, mobile + desktop lab results; field CWV when Google has it. */
export async function collectPageSpeed(domain: string, apiKey: string | undefined): Promise<{ evidence: Evidence[]; screenshot: string | null }> {
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
  const reason = (r: PromiseSettledResult<Item>) => (r.status === 'rejected' ? String((r.reason as Error).message) : 'No performance score returned.');
  const at = (r: PromiseSettledResult<Item>) => (r.status === 'fulfilled' ? String((r.value.lighthouseResult as Item | undefined)?.fetchTime ?? now()) : now());
  const evidence: Evidence[] = [];
  const m = score(mobile);
  const d = score(desktop);
  evidence.push(m === null ? ev('pagespeed', 'performance_mobile', 'Performance (mobile)', null, { missingReason: reason(mobile) }) : ev('pagespeed', 'performance_mobile', 'Performance (mobile)', m, { unit: '/100', observedAt: at(mobile) }));
  evidence.push(d === null ? ev('pagespeed', 'performance_desktop', 'Performance (desktop)', null, { missingReason: reason(desktop) }) : ev('pagespeed', 'performance_desktop', 'Performance (desktop)', d, { unit: '/100', observedAt: at(desktop) }));
  let screenshot: string | null = null;
  if (mobile.status === 'fulfilled') {
    const cat = ((mobile.value.loadingExperience as Item | undefined)?.overall_category ?? (mobile.value.originLoadingExperience as Item | undefined)?.overall_category) as string | undefined;
    evidence.push(cat ? ev('pagespeed', 'core_web_vitals', 'Core Web Vitals (field data)', cat, { observedAt: at(mobile) }) : ev('pagespeed', 'core_web_vitals', 'Core Web Vitals (field data)', null, { missingReason: 'Google has no field data for this site.' }));
    const shot = ((((mobile.value.lighthouseResult as Item | undefined)?.audits as Item | undefined)?.['final-screenshot'] as Item | undefined)?.details as Item | undefined)?.data;
    if (typeof shot === 'string' && shot.startsWith('data:image/') && shot.length < 400_000) screenshot = shot;
  } else evidence.push(ev('pagespeed', 'core_web_vitals', 'Core Web Vitals (field data)', null, { missingReason: reason(mobile) }));
  return { evidence, screenshot };
}

let rdapBootstrap: { at: number; services: [string[], string[]][] } | null = null;

/** RDAP via the IANA bootstrap registry (authoritative service per TLD). Redacted records are missing data. */
export async function collectRdap(domain: string): Promise<Evidence[]> {
  if (!rdapBootstrap || Date.now() - rdapBootstrap.at > 86_400_000) {
    const r = await fetch('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    const j = r?.ok ? ((await r.json().catch(() => null)) as { services?: [string[], string[]][] } | null) : null;
    if (j?.services) rdapBootstrap = { at: Date.now(), services: j.services };
  }
  const labels = domain.split('.');
  const candidates = [labels.slice(-2).join('.'), labels.slice(-3).join('.'), domain].filter((d, i, a) => d.split('.').length >= 2 && a.indexOf(d) === i);
  for (const d of candidates) {
    const tld = d.split('.').pop()!;
    const base = rdapBootstrap?.services.find(([tlds]) => tlds.includes(tld))?.[1]?.find((u) => u.startsWith('https://'));
    if (!base) continue;
    const res = await fetch(`${base.replace(/\/$/, '')}/domain/${encodeURIComponent(d)}`, { headers: { accept: 'application/rdap+json' }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!res?.ok) continue;
    const j = (await res.json().catch(() => null)) as { events?: { eventAction?: string; eventDate?: string }[]; status?: string[] } | null;
    const reg = j?.events?.find((e) => e.eventAction === 'registration')?.eventDate ?? null;
    const age = reg ? Math.max(0, Math.round(((Date.now() - new Date(reg).getTime()) / (365.25 * 86_400_000)) * 10) / 10) : null;
    const status = j?.status?.length ? j.status.join(', ') : null;
    return [
      age === null ? ev('rdap', 'domain_age_years', 'Domain age', null, { missingReason: 'Registration date not published (record may be redacted).' }) : ev('rdap', 'domain_age_years', 'Domain age', age, { unit: 'years' }),
      status === null ? ev('rdap', 'status', 'Registration status', null, { missingReason: 'Status not published.' }) : ev('rdap', 'status', 'Registration status', status),
      reg === null ? ev('rdap', 'registered_at', 'Registration date', null, { missingReason: 'Registration date not published.' }) : ev('rdap', 'registered_at', 'Registration date', reg.slice(0, 10)),
    ];
  }
  return missing('rdap', RDAP_METRICS, rdapBootstrap ? 'No RDAP service returned a record for this domain.' : 'The IANA RDAP bootstrap registry was unavailable.');
}

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

/** DataForSEO Labs domain overview: modeled third-party visibility estimates (not visitors). */
export async function collectDataForSeo(client: DataForSeoClient, domain: string, country: string, language: string): Promise<{ evidence: Evidence[]; trend: TrendPoint[] }> {
  const location_name = client.locationName(country);
  const period = { periodStart: null, periodEnd: null };
  let evidence: Evidence[];
  try {
    const r = await client.request('/dataforseo_labs/google/domain_rank_overview/live', { target: domain, location_name, language_code: language }, 'valuation.rank_overview');
    const organic = (((r?.items as Item[] | undefined)?.[0]?.metrics as Item | undefined)?.organic as Item | undefined) ?? null;
    if (!organic) {
      evidence = [
        ev('dataforseo', 'estimated_organic_visits', 'Estimated organic visits / month', 0, { ...period, unit: 'visits (modeled)' }),
        ev('dataforseo', 'ranking_keywords', 'Ranking keywords', 0, period),
        ev('dataforseo', 'avg_position', 'Average ranking position', null, { missingReason: 'The domain has no tracked rankings.' }),
      ];
    } else {
      const buckets: [string, number][] = [['pos_1', 1], ['pos_2_3', 2.5], ['pos_4_10', 7], ['pos_11_20', 15.5], ['pos_21_30', 25.5], ['pos_31_40', 35.5], ['pos_41_50', 45.5], ['pos_51_60', 55.5], ['pos_61_70', 65.5], ['pos_71_80', 75.5], ['pos_81_90', 85.5], ['pos_91_100', 95.5]];
      const counted = buckets.map(([k, mid]) => [num(organic[k]) ?? 0, mid] as const);
      const total = counted.reduce((t, [c]) => t + c, 0);
      evidence = [
        ev('dataforseo', 'estimated_organic_visits', 'Estimated organic visits / month', Math.round(num(organic.etv) ?? 0), { unit: 'visits (modeled)' }),
        ev('dataforseo', 'ranking_keywords', 'Ranking keywords', num(organic.count) ?? 0),
        total ? ev('dataforseo', 'avg_position', 'Average ranking position', Math.round((counted.reduce((t, [c, mid]) => t + c * mid, 0) / total) * 10) / 10) : ev('dataforseo', 'avg_position', 'Average ranking position', null, { missingReason: 'No ranking positions returned.' }),
      ];
    }
  } catch (e) {
    return { evidence: missing('dataforseo', DATAFORSEO_METRICS, (e as Error).message), trend: [] };
  }
  let trend: TrendPoint[] = [];
  try {
    const r = await client.request('/dataforseo_labs/google/historical_rank_overview/live', { target: domain, location_name, language_code: language }, 'valuation.rank_history');
    trend = ((r?.items as Item[] | undefined) ?? [])
      .map((i) => ({ month: monthKey(Number(i.year), Number(i.month)), value: Math.round(num((((i.metrics as Item | undefined)?.organic as Item | undefined) ?? {}).etv) ?? 0) }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  } catch {
    trend = [];
  }
  return { evidence, trend };
}
