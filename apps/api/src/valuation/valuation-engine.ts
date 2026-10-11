/**
 * Website valuation engine: pure functions, no I/O.
 *
 * Model (documented for admins in Valuation Engine Settings → Formula Details):
 *  1. Each factor gets a 0–1 score from the collected signals (null = no data).
 *  2. Composite score S = Σ wᵢ·sᵢ / Σ wᵢ over factors with data.
 *  3. Annual traffic value A = monthly organic traffic value × 12 (keyword
 *     traffic cost from the SEO data provider, else visits × value per visit).
 *  4. Traffic-based value = A × (minMultiplier + (maxMultiplier − minMultiplier) × S).
 *  5. With revenue information: profit-based value = annual profit × (1.5 + 2.5·S),
 *     blended 60/40 with the traffic-based value.
 *  6. Range = midpoint × (1 ± industryAdjustment × (2 − confidence)), rounded.
 *  7. Confidence = weighted coverage, source reliability, freshness and
 *     cross-source consistency.
 */

export const FACTORS = ['traffic', 'backlinks', 'content', 'technical', 'social', 'brand'] as const;
export type Factor = (typeof FACTORS)[number];

export const FACTOR_LABELS: Record<Factor, string> = {
  traffic: 'SEO & Organic Traffic',
  backlinks: 'Backlinks & Authority',
  content: 'Content Value',
  technical: 'Technical Health',
  social: 'Social & Referral Traffic',
  brand: 'Brand & Market Factors',
};

export const SOURCES = ['ga4', 'gsc', 'dataforseo', 'pagespeed', 'rdap', 'social'] as const;
export type SourceKey = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<SourceKey, string> = {
  ga4: 'Google Analytics 4 (GA4)',
  gsc: 'Google Search Console',
  dataforseo: 'DataForSEO',
  pagespeed: 'PageSpeed Insights',
  rdap: 'WHOIS / RDAP',
  social: 'Social Media Signals',
};

export type PlanAccessLevel = 'off' | 'limited' | 'full' | 'full_api';

export type ValuationSettings = {
  weights: Record<Factor, number>;
  multipliers: { min: number; max: number };
  /** ± percentage applied around the midpoint (scaled by confidence). */
  industryAdjustmentPct: number;
  currency: { code: string; rateFromUsd: number };
  showRange: boolean;
  /** USD per organic visit when no keyword traffic value is available. */
  valuePerVisitUsd: number;
  sources: Record<SourceKey, boolean>;
  confidence: { coverage: number; reliability: number; freshness: number; consistency: number };
  thresholds: { low: number; high: number };
  /** Keyed by plan code; `free` covers visitors without an account or plan. */
  access: Record<string, PlanAccessLevel>;
  limits: { freePerMonth: number; paidPerMonth: number; pdfPerMonth: number; apiAccess: boolean };
  exports: { pdf: boolean; csv: boolean; json: boolean };
  features: { verifiedValuation: boolean; opportunities: boolean; socialSection: boolean };
  calculator: { enabled: boolean; cacheHours: number; country: string; language: string };
  report: { sections: Record<ReportSection, boolean>; disclaimer: string };
};

export const REPORT_SECTIONS = ['traffic', 'backlinks', 'content', 'social', 'technical', 'domain', 'breakdown', 'opportunities'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const DEFAULT_SETTINGS: ValuationSettings = {
  weights: { traffic: 35, backlinks: 25, content: 15, technical: 10, social: 8, brand: 7 },
  multipliers: { min: 0.5, max: 5 },
  industryAdjustmentPct: 30,
  currency: { code: 'USD', rateFromUsd: 1 },
  showRange: true,
  valuePerVisitUsd: 0.35,
  sources: { ga4: true, gsc: true, dataforseo: true, pagespeed: true, rdap: true, social: true },
  confidence: { coverage: 40, reliability: 25, freshness: 20, consistency: 15 },
  thresholds: { low: 40, high: 70 },
  access: { free: 'limited' },
  limits: { freePerMonth: 3, paidPerMonth: 50, pdfPerMonth: 10, apiAccess: true },
  exports: { pdf: true, csv: true, json: true },
  features: { verifiedValuation: true, opportunities: true, socialSection: true },
  calculator: { enabled: true, cacheHours: 24, country: 'us', language: 'en' },
  report: {
    sections: { traffic: true, backlinks: true, content: true, social: true, technical: true, domain: true, breakdown: true, opportunities: true },
    disclaimer: 'This valuation is an estimate based on publicly available data and industry benchmarks. It is not financial advice or an appraisal.',
  },
};

/** Deep-merges stored settings over the defaults (missing keys keep defaults). */
export function withDefaults(stored: unknown): ValuationSettings {
  const merge = (base: unknown, over: unknown): unknown => {
    if (!over || typeof over !== 'object' || Array.isArray(over) || !base || typeof base !== 'object' || Array.isArray(base)) return over ?? base;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) out[k] = v === undefined ? out[k] : merge(out[k], v);
    return out;
  };
  return merge(DEFAULT_SETTINGS, stored) as ValuationSettings;
}

export function validateSettings(s: ValuationSettings): string[] {
  const errors: string[] = [];
  const total = FACTORS.reduce((t, f) => t + Number(s.weights[f] ?? 0), 0);
  if (FACTORS.some((f) => !(s.weights[f] >= 0 && s.weights[f] <= 100))) errors.push('Factor weights must be between 0 and 100.');
  if (Math.round(total) !== 100) errors.push(`Factor weights must total 100% (currently ${Math.round(total * 10) / 10}%).`);
  const ctotal = Object.values(s.confidence).reduce((t, v) => t + Number(v), 0);
  if (Math.round(ctotal) !== 100) errors.push(`Confidence weights must total 100% (currently ${Math.round(ctotal)}%).`);
  if (!(s.multipliers.min > 0 && s.multipliers.max >= s.multipliers.min && s.multipliers.max <= 50)) errors.push('Multipliers must satisfy 0 < minimum ≤ maximum ≤ 50.');
  if (!(s.industryAdjustmentPct >= 0 && s.industryAdjustmentPct <= 90)) errors.push('Industry adjustment must be between 0% and 90%.');
  if (!(s.thresholds.low > 0 && s.thresholds.high > s.thresholds.low && s.thresholds.high <= 100)) errors.push('Confidence thresholds must satisfy 0 < low < high ≤ 100.');
  if (!/^[A-Z]{3}$/.test(s.currency.code) || !(s.currency.rateFromUsd > 0)) errors.push('Currency needs a 3-letter code and a positive rate from USD.');
  if (!(s.valuePerVisitUsd >= 0 && s.valuePerVisitUsd <= 100)) errors.push('Value per visit must be between 0 and 100 USD.');
  for (const [k, v] of Object.entries(s.limits)) if (k !== 'apiAccess' && !(Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100000)) errors.push(`Limit "${k}" must be a whole number between 0 and 100000.`);
  if (!(s.calculator.cacheHours >= 0 && s.calculator.cacheHours <= 720)) errors.push('Result caching must be between 0 and 720 hours.');
  for (const v of Object.values(s.access)) if (!['off', 'limited', 'full', 'full_api'].includes(v)) errors.push('Plan access levels must be off, limited, full or full_api.');
  return errors;
}

/** Signals collected for one domain. Missing data is null, never zero. */
export type Signals = {
  organicVisits: number | null;
  /** USD per month (keyword traffic cost). */
  organicTrafficValue: number | null;
  rankingKeywords: number | null;
  avgPosition: number | null;
  referringDomains: number | null;
  backlinks: number | null;
  /** 0–100. */
  domainAuthority: number | null;
  contentPages: number | null;
  pagespeedMobile: number | null;
  pagespeedDesktop: number | null;
  coreWebVitals: 'good' | 'needs_improvement' | 'poor' | null;
  https: boolean | null;
  crawlable: boolean | null;
  indexable: boolean | null;
  domainAgeYears: number | null;
  tld: string;
  /** 0–1 share of keyword volume that contains the brand name. */
  brandShare: number | null;
  avgKeywordDifficulty: number | null;
  socialVisits: number | null;
  totalVisits: number | null;
  trafficGrowthPct: number | null;
  backlinkGrowthPct: number | null;
  /** Verified (GA4/GSC) organic traffic when connected. */
  verifiedOrganicVisits: number | null;
};

export type BusinessInputs = {
  monthlyRevenue?: number | null;
  annualRevenue?: number | null;
  /** e.g. "10-20" (percent range). */
  profitMargin?: string | null;
  monthlyVisits?: number | null;
};

export type SourceState = 'verified' | 'estimated' | 'unavailable' | 'disabled';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const logScore = (n: number | null, decades: number) => (n === null ? null : clamp01(Math.log10(Math.max(0, n) + 1) / decades));
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function factorScores(sig: Signals): Record<Factor, number | null> {
  const visits = sig.verifiedOrganicVisits ?? sig.organicVisits;
  const authority = sig.domainAuthority === null ? null : clamp01(sig.domainAuthority / 100);
  const refd = logScore(sig.referringDomains, 4.5);
  const pages = logScore(sig.contentPages, 4);
  const kws = logScore(sig.rankingKeywords, 5);
  const speed = avg([sig.pagespeedMobile, sig.pagespeedDesktop]);
  const cwv = sig.coreWebVitals === null ? null : { good: 1, needs_improvement: 0.5, poor: 0 }[sig.coreWebVitals];
  const tech = [speed === null ? null : (speed / 100) * 0.5, sig.https === null ? null : (sig.https ? 1 : 0) * 0.15, sig.crawlable === null ? null : (sig.crawlable ? 1 : 0) * 0.1, sig.indexable === null ? null : (sig.indexable ? 1 : 0) * 0.1, cwv === null ? null : cwv * 0.15];
  const techWeights = [0.5, 0.15, 0.1, 0.1, 0.15];
  const techAvail = tech.reduce<number>((t, v, i) => t + (v === null ? 0 : techWeights[i]), 0);
  const social =
    sig.socialVisits === null
      ? null
      : clamp01(0.5 * (logScore(sig.socialVisits, 5) ?? 0) + 0.5 * clamp01(sig.totalVisits ? (sig.socialVisits / sig.totalVisits) * 5 : 0));
  const tldScore = ['com', 'org', 'net', 'io', 'co', 'ai'].includes(sig.tld) ? 1 : 0.6;
  const brandParts = [sig.domainAgeYears === null ? null : clamp01(sig.domainAgeYears / 15) * 0.6, tldScore * 0.2, sig.brandShare === null ? null : clamp01(sig.brandShare * 5) * 0.2];
  const brandAvail = (sig.domainAgeYears === null ? 0 : 0.6) + 0.2 + (sig.brandShare === null ? 0 : 0.2);
  return {
    traffic: logScore(visits, 6),
    backlinks: refd === null && authority === null ? null : refd === null ? authority : authority === null ? refd : 0.6 * refd + 0.4 * authority,
    content: pages === null && kws === null ? null : pages === null ? kws : kws === null ? pages : 0.5 * pages + 0.5 * kws,
    technical: techAvail >= 0.3 ? tech.reduce<number>((t, v) => t + (v ?? 0), 0) / techAvail : null,
    social,
    brand: brandParts.reduce<number>((t, v) => t + (v ?? 0), 0) / brandAvail,
  };
}

export function confidenceLabel(confidence: number, s: ValuationSettings) {
  return confidence >= s.thresholds.high ? 'Good' : confidence >= s.thresholds.low ? 'Fair' : 'Low';
}

/** Projects a midpoint margin from a range like "10-20" (percent). */
export function marginOf(range: string | null | undefined) {
  const m = /^(\d{1,2})-(\d{1,3})$/.exec(range ?? '');
  return m ? (Number(m[1]) + Number(m[2])) / 200 : null;
}

const roundTo = (n: number, step: number) => Math.max(0, Math.round(n / step) * step);
const niceStep = (n: number) => (n < 5_000 ? 100 : n < 100_000 ? 500 : n < 1_000_000 ? 5_000 : 50_000);

export type Valuation = {
  scores: Record<Factor, number | null>;
  composite: number;
  breakdown: { factor: Factor; label: string; weight: number; score: number | null; contributionPct: number }[];
  annualTrafficValueUsd: number;
  valueMid: number;
  valueLow: number;
  valueHigh: number;
  currency: string;
  confidence: number;
  confidenceLabel: string;
  confidenceParts: { coverage: number; reliability: number; freshness: number; consistency: number };
  method: 'traffic' | 'traffic+revenue';
};

export function valuate(sig: Signals, sources: Record<SourceKey, SourceState>, s: ValuationSettings, business: BusinessInputs = {}): Valuation {
  const scores = factorScores(sig);
  const enabledFactors = FACTORS.filter((f) => s.weights[f] > 0 && !(f === 'social' && !s.sources.social));
  const withData = enabledFactors.filter((f) => scores[f] !== null);
  const wSum = withData.reduce((t, f) => t + s.weights[f], 0);
  const composite = wSum ? withData.reduce((t, f) => t + s.weights[f] * (scores[f] as number), 0) / wSum : 0;
  const contribTotal = withData.reduce((t, f) => t + s.weights[f] * (scores[f] as number), 0);
  const breakdown = FACTORS.map((f) => ({
    factor: f,
    label: FACTOR_LABELS[f],
    weight: s.weights[f],
    score: scores[f] === null ? null : Math.round((scores[f] as number) * 100) / 100,
    contributionPct: contribTotal && scores[f] !== null && enabledFactors.includes(f) ? Math.round(((s.weights[f] * (scores[f] as number)) / contribTotal) * 100) : 0,
  }));

  const visits = business.monthlyVisits ?? sig.verifiedOrganicVisits ?? sig.organicVisits ?? 0;
  const monthlyValue = sig.organicTrafficValue !== null && sig.verifiedOrganicVisits === null && !business.monthlyVisits ? sig.organicTrafficValue : visits * s.valuePerVisitUsd;
  const annualTrafficValueUsd = Math.max(0, monthlyValue * 12);
  const multiplier = s.multipliers.min + (s.multipliers.max - s.multipliers.min) * composite;
  let midUsd = annualTrafficValueUsd * multiplier;
  let method: Valuation['method'] = 'traffic';
  const annualRevenue = business.annualRevenue ?? (business.monthlyRevenue ? business.monthlyRevenue * 12 : null);
  if (annualRevenue && annualRevenue > 0) {
    const profit = annualRevenue * (marginOf(business.profitMargin) ?? 0.2);
    midUsd = 0.6 * profit * (1.5 + 2.5 * composite) + 0.4 * midUsd;
    method = 'traffic+revenue';
  }

  // Confidence.
  const relevant = SOURCES.filter((k) => sources[k] !== 'disabled');
  const coverage = enabledFactors.length ? withData.length / enabledFactors.length : 0;
  const available = relevant.filter((k) => sources[k] === 'verified' || sources[k] === 'estimated');
  const reliability = available.length ? available.reduce((t, k) => t + (sources[k] === 'verified' ? 1 : 0.65), 0) / Math.max(available.length, 3) : 0;
  const freshness = 1;
  const est = sig.organicVisits;
  const ver = sig.verifiedOrganicVisits ?? business.monthlyVisits ?? null;
  const consistency = est !== null && ver !== null && Math.max(est, ver) > 0 ? 1 - clamp01(Math.abs(est - ver) / Math.max(est, ver)) : 0.6;
  const parts = { coverage, reliability: clamp01(reliability), freshness, consistency };
  const cw = s.confidence;
  const cwSum = cw.coverage + cw.reliability + cw.freshness + cw.consistency || 1;
  const confidence = Math.round(((cw.coverage * parts.coverage + cw.reliability * parts.reliability + cw.freshness * parts.freshness + cw.consistency * parts.consistency) / cwSum) * 100);

  const rate = s.currency.rateFromUsd;
  const mid = midUsd * rate;
  const spread = (s.industryAdjustmentPct / 100) * (2 - confidence / 100) * 0.7;
  const step = niceStep(mid);
  return {
    scores,
    composite: Math.round(composite * 1000) / 1000,
    breakdown,
    annualTrafficValueUsd: Math.round(annualTrafficValueUsd),
    valueMid: roundTo(mid, step),
    valueLow: roundTo(mid * (1 - Math.min(spread, 0.9)), step),
    valueHigh: roundTo(mid * (1 + spread), step),
    currency: s.currency.code,
    confidence,
    confidenceLabel: confidenceLabel(confidence, s),
    confidenceParts: { coverage: Math.round(parts.coverage * 100), reliability: Math.round(parts.reliability * 100), freshness: Math.round(parts.freshness * 100), consistency: Math.round(parts.consistency * 100) },
    method,
  };
}

/** Plain-language drivers, risks and improvement opportunities. */
export function insights(sig: Signals, v: Valuation) {
  const sc = v.scores;
  const drivers: string[] = [];
  const risks: string[] = [];
  if ((sc.traffic ?? 0) >= 0.45) drivers.push(sig.trafficGrowthPct !== null && sig.trafficGrowthPct > 5 ? 'Strong organic traffic growth' : 'Strong organic traffic');
  else if (sc.traffic !== null) risks.push('Limited organic traffic');
  if ((sc.backlinks ?? 0) >= 0.45) drivers.push('High-quality backlink profile');
  else if (sc.backlinks !== null) risks.push('Weak backlink profile');
  if ((sc.content ?? 0) >= 0.5) drivers.push('Relevant, authoritative content');
  else if (sc.content !== null) risks.push('Content depth could be improved');
  if ((sc.technical ?? 0) >= 0.7) drivers.push('Good technical SEO health');
  else if (sc.technical !== null) risks.push('Technical improvements needed');
  if ((sig.domainAgeYears ?? 0) >= 5) drivers.push('Established domain history');
  if ((sc.social ?? 0) >= 0.4) drivers.push('Growing social media presence');
  else risks.push('Limited social diversification');
  if (sig.brandShare !== null && sig.brandShare < 0.05) risks.push('Limited brand search volume');
  if ((sig.avgKeywordDifficulty ?? 0) >= 50) risks.push('High competitor landscape');
  if (sig.trafficGrowthPct !== null && sig.trafficGrowthPct < -10) risks.push('Declining organic traffic');

  const ideas: Record<Factor, string> = {
    traffic: 'Improve organic traffic and keyword rankings',
    backlinks: 'Build high-quality backlinks from relevant sites',
    content: 'Expand and optimize content depth',
    technical: 'Improve technical performance (Core Web Vitals)',
    social: 'Grow and diversify social media traffic',
    brand: 'Strengthen brand presence and market position',
  };
  const opportunities = [...FACTORS]
    .sort((a, b) => (sc[a] ?? 0) - (sc[b] ?? 0) || v.breakdown.find((x) => x.factor === b)!.weight - v.breakdown.find((x) => x.factor === a)!.weight)
    .map((f) => ideas[f]);
  return { drivers: drivers.slice(0, 6), risks: risks.slice(0, 5), opportunities };
}

/** Percent change of the last `n` points against the `n` before them. */
export function periodChange(series: number[], n = 6) {
  if (series.length < n * 2) return null;
  const cur = series.slice(-n).reduce((a, b) => a + b, 0);
  const prev = series.slice(-n * 2, -n).reduce((a, b) => a + b, 0);
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}
