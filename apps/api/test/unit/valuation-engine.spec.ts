import { DEFAULT_SETTINGS, factorScores, insights, marginOf, periodChange, Signals, SourceKey, SourceState, valuate, validateSettings, withDefaults } from '../../src/valuation/valuation-engine';
import { blocksEverything, emptySignals } from '../../src/valuation/valuation-sources';
import { describeChanges } from '../../src/valuation/valuation.service';

const sources = (over: Partial<Record<SourceKey, SourceState>> = {}): Record<SourceKey, SourceState> => ({
  ga4: 'unavailable',
  gsc: 'unavailable',
  dataforseo: 'estimated',
  pagespeed: 'estimated',
  rdap: 'estimated',
  social: 'unavailable',
  ...over,
});

const site = (over: Partial<Signals> = {}): Signals => ({
  ...emptySignals('example.com'),
  organicVisits: 12_400,
  organicTrafficValue: 900,
  rankingKeywords: 3_200,
  avgPosition: 18.5,
  referringDomains: 3_800,
  backlinks: 12_600,
  domainAuthority: 62,
  contentPages: 320,
  pagespeedMobile: 86,
  pagespeedDesktop: 94,
  coreWebVitals: 'good',
  https: true,
  crawlable: true,
  indexable: true,
  domainAgeYears: 12,
  brandShare: 0.03,
  avgKeywordDifficulty: 55,
  trafficGrowthPct: 28,
  ...over,
});

describe('valuation engine', () => {
  it('scores factors between 0 and 1 and leaves missing data as null', () => {
    const scores = factorScores(site());
    for (const v of Object.values(scores)) if (v !== null) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
    expect(scores.social).toBeNull();
    expect(factorScores(emptySignals('example.com')).traffic).toBeNull();
  });

  it('produces an ordered range around the midpoint and contributions that sum to ~100%', () => {
    const v = valuate(site(), sources(), DEFAULT_SETTINGS);
    expect(v.valueLow).toBeLessThan(v.valueMid);
    expect(v.valueMid).toBeLessThan(v.valueHigh);
    expect(v.valueMid).toBeGreaterThan(0);
    const total = v.breakdown.reduce((t, b) => t + b.contributionPct, 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
    expect(v.breakdown.find((b) => b.factor === 'social')!.contributionPct).toBe(0);
  });

  it('values bigger sites higher, all else equal', () => {
    const small = valuate(site({ organicVisits: 1_000, organicTrafficValue: 80 }), sources(), DEFAULT_SETTINGS);
    const big = valuate(site({ organicVisits: 200_000, organicTrafficValue: 20_000 }), sources(), DEFAULT_SETTINGS);
    expect(big.valueMid).toBeGreaterThan(small.valueMid * 10);
  });

  it('raises confidence when verified sources agree with the estimate', () => {
    const est = valuate(site(), sources(), DEFAULT_SETTINGS);
    const ver = valuate(site({ verifiedOrganicVisits: 12_000, socialVisits: 900, totalVisits: 20_000 }), sources({ ga4: 'verified', gsc: 'verified', social: 'verified' }), DEFAULT_SETTINGS);
    expect(ver.confidence).toBeGreaterThan(est.confidence);
    // Higher confidence narrows the range.
    expect((ver.valueHigh - ver.valueLow) / ver.valueMid).toBeLessThan((est.valueHigh - est.valueLow) / est.valueMid);
  });

  it('blends revenue into the value when supplied', () => {
    const plain = valuate(site(), sources(), DEFAULT_SETTINGS);
    const rev = valuate(site(), sources(), DEFAULT_SETTINGS, { annualRevenue: 1_000_000, profitMargin: '20-30' });
    expect(rev.method).toBe('traffic+revenue');
    expect(rev.valueMid).toBeGreaterThan(plain.valueMid);
    expect(marginOf('20-30')).toBeCloseTo(0.25);
    expect(marginOf('bad')).toBeNull();
  });

  it('converts to the configured currency', () => {
    const usd = valuate(site(), sources(), DEFAULT_SETTINGS);
    const eur = valuate(site(), sources(), withDefaults({ currency: { code: 'EUR', rateFromUsd: 0.5 } }));
    expect(eur.currency).toBe('EUR');
    expect(Math.abs(eur.valueMid - usd.valueMid / 2)).toBeLessThanOrEqual(500);
  });

  it('explains drivers, risks and orders opportunities by weakness', () => {
    const v = valuate(site(), sources(), DEFAULT_SETTINGS);
    const i = insights(site(), v);
    expect(i.drivers).toContain('Strong organic traffic growth');
    expect(i.drivers).toContain('Established domain history');
    expect(i.risks).toContain('Limited brand search volume');
    expect(i.risks).toContain('High competitor landscape');
    expect(i.opportunities[0]).toBe('Grow and diversify social media traffic');
  });

  it('validates settings', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
    expect(validateSettings(withDefaults({ weights: { traffic: 50 } })).join(' ')).toMatch(/total 100%/);
    expect(validateSettings(withDefaults({ multipliers: { min: 6, max: 5 } })).length).toBeGreaterThan(0);
    expect(validateSettings(withDefaults({ thresholds: { low: 80, high: 70 } })).length).toBeGreaterThan(0);
    expect(validateSettings(withDefaults({ access: { pro: 'everything' } })).length).toBeGreaterThan(0);
  });

  it('describes setting changes for the history', () => {
    const next = withDefaults({ weights: { traffic: 30, backlinks: 30 }, sources: { social: false } });
    expect(describeChanges(DEFAULT_SETTINGS, next)).toBe('Updated SEO & Organic Traffic weight (35% → 30%); Updated Backlinks & Authority weight (25% → 30%); Disabled Social Media Signals');
  });

  it('computes period change and robots blocking', () => {
    expect(periodChange([1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2])).toBe(100);
    expect(periodChange([1, 2])).toBeNull();
    expect(blocksEverything('User-agent: *\nDisallow: /')).toBe(true);
    expect(blocksEverything('User-agent: *\nDisallow: /admin\n\nUser-agent: BadBot\nDisallow: /')).toBe(false);
    expect(blocksEverything('User-agent: Googlebot\nUser-agent: *\nDisallow: /')).toBe(true);
    expect(blocksEverything('')).toBe(false);
  });
});
