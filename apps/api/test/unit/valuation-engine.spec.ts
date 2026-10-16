import { calculate, checksum, Comparable, DEFAULT_CONFIG, Evidence, validateConfig, withDefaults } from '../../src/valuation/valuation-engine';
import { blocksEverything, ev } from '../../src/valuation/valuation-sources';

/** A well-run site: crawler, PageSpeed, RDAP and DataForSEO evidence all available. */
const site = (): Evidence[] => [
  ev('crawler', 'http_ok', 'Home page responds', true),
  ev('crawler', 'https', 'HTTPS', true),
  ev('crawler', 'redirect_hops', 'Redirect hops', 1),
  ev('crawler', 'indexable', 'Indexable', true),
  ev('crawler', 'crawlable', 'Crawlable', true),
  ev('crawler', 'title_length', 'Title length', 52),
  ev('crawler', 'meta_description_length', 'Description length', 140),
  ev('crawler', 'h1_count', 'H1', 1),
  ev('crawler', 'h2_count', 'H2', 6),
  ev('crawler', 'canonical_valid', 'Canonical', true),
  ev('crawler', 'structured_data', 'Schema', true),
  ev('crawler', 'word_count', 'Words', 1400),
  ev('crawler', 'sitemap_urls', 'Sitemap URLs', 320),
  ev('pagespeed', 'performance_mobile', 'Mobile', 86),
  ev('pagespeed', 'performance_desktop', 'Desktop', 94),
  ev('pagespeed', 'core_web_vitals', 'CWV', 'FAST'),
  ev('rdap', 'domain_age_years', 'Age', 12),
  ev('rdap', 'status', 'Status', 'active'),
  ev('dataforseo', 'estimated_organic_visits', 'Visits', 12_400),
  ev('dataforseo', 'ranking_keywords', 'Keywords', 3_200),
  ev('dataforseo', 'avg_position', 'Position', 18.5),
];

const comps: Comparable[] = [
  { id: 'c1', label: 'Content sites 2026', businessModel: 'content', multipleLow: 2.5, multipleHigh: 3.5, observedAt: '2026-06-01', source: 'Broker report' },
  { id: 'c2', label: 'Old SaaS deals', businessModel: 'saas', multipleLow: 4, multipleHigh: 6, observedAt: '2021-01-01', source: 'Archive' },
];
const now = new Date('2026-10-13T00:00:00Z');

describe('valuation engine (V1 manual)', () => {
  it('produces a 0–100 quality score with published composition', () => {
    const r = calculate(site(), DEFAULT_CONFIG, {}, now);
    expect(r.qualityScore).toBeGreaterThan(50);
    expect(r.qualityScore).toBeLessThanOrEqual(100);
    expect(r.evidenceCoveragePct).toBe(100);
    expect(r.breakdown.map((b) => b.weight)).toEqual([25, 25, 15, 20, 15]);
    const total = r.breakdown.reduce((t, b) => t + b.contributionPct, 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
  });

  it('never produces a monetary value without earnings and comparables (fail-safe)', () => {
    const r = calculate(site(), withDefaults({ comparables: comps }), {}, now);
    expect(r.monetary).toBeNull();
    expect(r.limitations[0]).toBe('Insufficient evidence for a monetary valuation.');
    expect(r.confidence).toBe('LOW');
    const noComps = calculate(site(), DEFAULT_CONFIG, { ttmRevenue: 200_000, ttmExpenses: 80_000, businessModel: 'content' }, now);
    expect(noComps.monetary).toBeNull();
    expect(noComps.limitations).toContain('No comparable transaction multiples are configured.');
  });

  it('uses earnings × current dated comparable multiples for the business model', () => {
    const c = withDefaults({ comparables: comps });
    const r = calculate(site(), c, { ttmRevenue: 200_000, ttmExpenses: 80_000, businessModel: 'content' }, now);
    expect(r.monetary).toMatchObject({ earnings: 120_000, multipleLow: 2.5, multipleHigh: 3.5, low: 300_000, high: 420_000, riskAdjusted: false });
    expect(r.limitations).toContain('Earnings are self-reported and have not been independently verified.');
    // A comparable older than the allowed age is ignored.
    const stale = calculate(site(), c, { ttmProfit: 100_000, businessModel: 'saas' }, now);
    expect(stale.monetary).toBeNull();
    // Negative earnings give no range.
    expect(calculate(site(), c, { ttmRevenue: 10_000, ttmExpenses: 50_000, businessModel: 'content' }, now).monetary).toBeNull();
  });

  it('grades confidence by rules: MEDIUM needs verified traffic + financials + comparables; never HIGH in V1', () => {
    const c = withDefaults({ comparables: comps });
    const fin = { ttmProfit: 120_000, businessModel: 'content' };
    expect(calculate(site(), c, fin, now).confidence).toBe('LOW');
    const verified = [...site(), ev('gsc', 'clicks_28d', 'Clicks', 9_000)];
    expect(calculate(verified, c, fin, now).confidence).toBe('MEDIUM');
    expect(calculate(verified, c, {}, now).confidence).toBe('LOW');
  });

  it('excludes missing categories, renormalizes, and withholds the score below the evidence threshold', () => {
    const onlyCrawler = site().filter((e) => e.source === 'crawler');
    const r = calculate(onlyCrawler, DEFAULT_CONFIG, {}, now);
    // technical 25 + content 20 + part of risk 15 have data = 60% → threshold met.
    expect(r.qualityScore).not.toBeNull();
    expect(r.breakdown.find((b) => b.category === 'performance')!.score).toBeNull();
    const strict = calculate(onlyCrawler, withDefaults({ minEvidencePct: 90 }), {}, now);
    expect(strict.qualityScore).toBeNull();
    expect(strict.limitations.join(' ')).toMatch(/Not enough evidence for a quality score/);
  });

  it('records missing evidence as unavailable, never as zero', () => {
    const e = ev('pagespeed', 'performance_mobile', 'Mobile', null, { missingReason: 'Timeout' });
    expect(e).toMatchObject({ status: 'unavailable', value: null, missingReason: 'Timeout', classification: 'observed' });
    const r = calculate([e], DEFAULT_CONFIG, {}, now);
    expect(r.breakdown.find((b) => b.category === 'performance')!.score).toBeNull();
  });

  it('applies the documented risk adjustment for low-quality sites', () => {
    const weak: Evidence[] = [ev('crawler', 'http_ok', 'ok', true), ev('crawler', 'https', 'https', false), ev('crawler', 'indexable', 'idx', false), ev('crawler', 'crawlable', 'crawl', false), ev('crawler', 'title_length', 't', 0), ev('crawler', 'meta_description_length', 'd', 0), ev('crawler', 'h1_count', 'h1', 0), ev('crawler', 'canonical_valid', 'c', false), ev('crawler', 'word_count', 'w', 50), ev('crawler', 'h2_count', 'h2', 0), ev('crawler', 'structured_data', 's', false), ev('crawler', 'sitemap_urls', 'u', 3), ev('rdap', 'domain_age_years', 'age', 0.5)];
    const r = calculate(weak, withDefaults({ comparables: comps }), { ttmProfit: 100_000, businessModel: 'content' }, now);
    expect(r.qualityScore!).toBeLessThan(50);
    expect(r.monetary).toMatchObject({ riskAdjusted: true, low: 215_000, high: 300_000 });
  });

  it('validates config and gives stable checksums', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual([]);
    expect(validateConfig(withDefaults({ weights: { visibility: 50 } })).join(' ')).toMatch(/total 100%/);
    expect(validateConfig(withDefaults({ comparables: [{ id: 'x', label: 'X', businessModel: 'any', multipleLow: 5, multipleHigh: 2, observedAt: '2026-01-01', source: 's' }] })).length).toBeGreaterThan(0);
    expect(validateConfig(withDefaults({ comparables: [{ id: 'x', label: 'X', businessModel: 'any', multipleLow: 1, multipleHigh: 2, observedAt: 'soon', source: 's' }] })).length).toBeGreaterThan(0);
    expect(validateConfig(withDefaults({ access: { pro: 'everything' } })).length).toBeGreaterThan(0);
    expect(checksum(withDefaults({}))).toBe(checksum(DEFAULT_CONFIG));
    expect(checksum(withDefaults({ minEvidencePct: 70 }))).not.toBe(checksum(DEFAULT_CONFIG));
  });

  it('parses robots.txt blocking rules', () => {
    expect(blocksEverything('User-agent: *\nDisallow: /')).toBe(true);
    expect(blocksEverything('User-agent: *\nDisallow: /admin\n\nUser-agent: BadBot\nDisallow: /')).toBe(false);
    expect(blocksEverything('User-agent: Googlebot\nUser-agent: *\nDisallow: /')).toBe(true);
    expect(blocksEverything('')).toBe(false);
  });
});
