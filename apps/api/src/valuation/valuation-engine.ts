import { createHash } from 'crypto';

/**
 * Website Value Calculator engine (V1 manual §05): pure functions, no I/O.
 *
 *  Step A — deterministic quality score 0–100: Σ(weightᵢ × normalizedᵢ) over
 *  categories with evidence; missing categories are excluded and the rest
 *  renormalized only when the evidence threshold is met. Otherwise no score.
 *
 *  Step B — an indicative monetary range ONLY with a calibrated basis:
 *  normalized annual owner earnings (user-supplied trailing 12 months, marked
 *  self-reported) × the range of administrator-maintained, dated comparable
 *  multiples for the business model, adjusted for documented risk. With no
 *  defensible basis the result is "Insufficient evidence for a monetary
 *  valuation" — an SEO score is never turned into a price.
 *
 *  Confidence (rules-based): HIGH needs attributable multi-period earnings
 *  evidence and comparables (independent earnings verification is not part of
 *  V1, so V1 never issues HIGH); MEDIUM = verified traffic (GA4/GSC) +
 *  self-reported business data + comparables; LOW otherwise.
 */

export const CATEGORIES = ['visibility', 'technical', 'performance', 'content', 'risk'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  visibility: 'Organic visibility',
  technical: 'Technical readiness',
  performance: 'Performance',
  content: 'Content & structure',
  risk: 'Risk / stability',
};

export const SOURCES = ['crawler', 'pagespeed', 'rdap', 'dataforseo', 'gsc', 'ga4'] as const;
export type SourceKey = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<SourceKey, string> = {
  crawler: 'AmpliVerify crawler',
  pagespeed: 'Google PageSpeed Insights',
  rdap: 'RDAP registration data',
  dataforseo: 'DataForSEO Labs',
  gsc: 'Google Search Console',
  ga4: 'Google Analytics 4',
};

/** Provenance classes from the manual (§03, §07). */
export type Classification = 'observed' | 'modeled' | 'verified' | 'self_reported' | 'public_record';

export const SOURCE_CLASS: Record<SourceKey, Classification> = {
  crawler: 'observed',
  pagespeed: 'observed',
  rdap: 'public_record',
  dataforseo: 'modeled',
  gsc: 'verified',
  ga4: 'verified',
};

/** One signal with its provenance. Missing data is recorded as unavailable, never as zero. */
export type Evidence = {
  source: SourceKey | 'user';
  metric: string;
  label: string;
  value: number | string | boolean | null;
  unit?: string | null;
  classification: Classification;
  status: 'available' | 'unavailable';
  observedAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  missingReason?: string | null;
};

export type Comparable = {
  id: string;
  label: string;
  /** Business model the multiples apply to, or "any". */
  businessModel: string;
  /** Annual owner-earnings multiples. */
  multipleLow: number;
  multipleHigh: number;
  /** Date of the transaction data (YYYY-MM-DD). */
  observedAt: string;
  source: string;
};

export type PlanAccessLevel = 'off' | 'public' | 'enhanced';

export type ValuationConfig = {
  weights: Record<Category, number>;
  /** Minimum share (0–100) of total weight that must have evidence before a score is shown. */
  minEvidencePct: number;
  comparables: Comparable[];
  /** Comparables older than this are not used. */
  comparableMaxAgeMonths: number;
  /** Documented-risk adjustment: below this quality score the range is reduced by `pct`. */
  riskAdjustment: { belowScore: number; pct: number };
  currency: string;
  /** Cache lifetime per source, in hours (manual §08). */
  cacheHours: { pagespeed: number; rankings: number; rdap: number; crawler: number };
  sources: Record<SourceKey, boolean>;
  /** Keyed by plan code; `free` covers visitors and accounts without a plan. */
  access: Record<string, PlanAccessLevel>;
  limits: { anonymousPerDay: number; anonymousPerDomainPerDay: number; userPerMonth: number; pdfPerMonth: number };
  /** Credits reserved for an enhanced (verified) valuation. */
  enhancedCredits: number;
  consentVersion: string;
  /** Days a result stays current before it is marked expired. */
  resultTtlDays: number;
  calculator: { enabled: boolean; country: string; language: string };
  disclaimer: string;
};

export const DEFAULT_CONFIG: ValuationConfig = {
  weights: { visibility: 25, technical: 25, performance: 15, content: 20, risk: 15 },
  minEvidencePct: 60,
  comparables: [],
  comparableMaxAgeMonths: 24,
  riskAdjustment: { belowScore: 50, pct: 15 },
  currency: 'USD',
  cacheHours: { pagespeed: 24, rankings: 168, rdap: 720, crawler: 24 },
  sources: { crawler: true, pagespeed: true, rdap: true, dataforseo: true, gsc: true, ga4: true },
  access: { free: 'public' },
  limits: { anonymousPerDay: 3, anonymousPerDomainPerDay: 2, userPerMonth: 50, pdfPerMonth: 10 },
  enhancedCredits: 0,
  consentVersion: '2026-10-13',
  resultTtlDays: 30,
  calculator: { enabled: true, country: 'us', language: 'en' },
  disclaimer:
    'This is an indicative estimate based on available evidence, not an appraisal or financial advice. A business valuation requires substantiated earnings and risk assumptions.',
};

export function withDefaults(stored: unknown): ValuationConfig {
  const merge = (base: unknown, over: unknown): unknown => {
    if (Array.isArray(over)) return over;
    if (!over || typeof over !== 'object' || !base || typeof base !== 'object' || Array.isArray(base)) return over ?? base;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) if (v !== undefined) out[k] = merge(out[k], v);
    return out;
  };
  return merge(DEFAULT_CONFIG, stored) as ValuationConfig;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateConfig(c: ValuationConfig): string[] {
  const errors: string[] = [];
  const total = CATEGORIES.reduce((t, k) => t + Number(c.weights[k] ?? 0), 0);
  if (CATEGORIES.some((k) => !(c.weights[k] >= 0 && c.weights[k] <= 100))) errors.push('Category weights must be between 0 and 100.');
  if (Math.round(total) !== 100) errors.push(`Category weights must total 100% (currently ${Math.round(total * 10) / 10}%).`);
  if (!(c.minEvidencePct >= 0 && c.minEvidencePct <= 100)) errors.push('The evidence threshold must be between 0% and 100%.');
  if (!(Number.isInteger(c.comparableMaxAgeMonths) && c.comparableMaxAgeMonths >= 1 && c.comparableMaxAgeMonths <= 120)) errors.push('Comparable age must be 1–120 months.');
  if (!(c.riskAdjustment.belowScore >= 0 && c.riskAdjustment.belowScore <= 100 && c.riskAdjustment.pct >= 0 && c.riskAdjustment.pct <= 90)) errors.push('Risk adjustment must use a score of 0–100 and 0–90%.');
  if (!/^[A-Z]{3}$/.test(c.currency)) errors.push('Currency must be a 3-letter code.');
  for (const [k, v] of Object.entries(c.cacheHours)) if (!(Number.isFinite(v) && v >= 0 && v <= 8760)) errors.push(`Cache time for ${k} must be 0–8760 hours.`);
  for (const v of Object.values(c.access)) if (!['off', 'public', 'enhanced'].includes(v)) errors.push('Plan access must be off, public or enhanced.');
  for (const [k, v] of Object.entries(c.limits)) if (!(Number.isInteger(v) && v >= 0 && v <= 100000)) errors.push(`Limit "${k}" must be a whole number 0–100000.`);
  if (!(Number.isInteger(c.enhancedCredits) && c.enhancedCredits >= 0 && c.enhancedCredits <= 10000)) errors.push('Enhanced valuation credits must be a whole number 0–10000.');
  if (!DATE.test(c.consentVersion)) errors.push('Consent version must be a date (YYYY-MM-DD).');
  if (!(Number.isInteger(c.resultTtlDays) && c.resultTtlDays >= 1 && c.resultTtlDays <= 365)) errors.push('Result lifetime must be 1–365 days.');
  const ids = new Set<string>();
  for (const m of c.comparables) {
    if (!m.id || ids.has(m.id)) errors.push('Each comparable needs a unique id.');
    ids.add(m.id);
    if (!m.label?.trim() || !m.source?.trim()) errors.push(`Comparable "${m.label || m.id}" needs a label and a source.`);
    if (!DATE.test(m.observedAt ?? '')) errors.push(`Comparable "${m.label || m.id}" needs a transaction date (YYYY-MM-DD).`);
    if (!(m.multipleLow > 0 && m.multipleHigh >= m.multipleLow && m.multipleHigh <= 50)) errors.push(`Comparable "${m.label || m.id}" multiples must satisfy 0 < low ≤ high ≤ 50.`);
  }
  return errors;
}

/** Stable checksum of a methodology config (version integrity). */
export function checksum(c: ValuationConfig) {
  const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v);
  return createHash('sha256').update(JSON.stringify(sort(c))).digest('hex');
}

/** Self-reported trailing-12-month financials (manual §04). */
export type FinancialInputs = {
  ttmRevenue?: number | null;
  ttmExpenses?: number | null;
  /** Owner earnings, if the user reports it directly. */
  ttmProfit?: number | null;
  businessModel?: string | null;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const logScore = (n: number, decades: number) => clamp01(Math.log10(Math.max(0, n) + 1) / decades);

/** Lookup of available evidence values. */
export function evidenceMap(ev: Evidence[]) {
  const m = new Map<string, Evidence>();
  for (const e of ev) if (e.status === 'available') m.set(e.metric, e);
  return {
    num: (k: string) => {
      const v = m.get(k)?.value;
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    },
    bool: (k: string) => {
      const v = m.get(k)?.value;
      return typeof v === 'boolean' ? v : null;
    },
    str: (k: string) => {
      const v = m.get(k)?.value;
      return typeof v === 'string' ? v : null;
    },
    has: (k: string) => m.has(k),
  };
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
/** Weighted mean of the parts that have data; null when none do. */
const parts = (xs: [number | null, number][]) => {
  const have = xs.filter((x): x is [number, number] => x[0] !== null);
  const w = have.reduce((t, [, wt]) => t + wt, 0);
  return w ? have.reduce((t, [v, wt]) => t + v * wt, 0) / w : null;
};

/** Normalized 0–1 score per category from the evidence; null = no evidence. */
export function categoryScores(ev: Evidence[]): Record<Category, number | null> {
  const e = evidenceMap(ev);
  const b = (k: string) => (e.bool(k) === null ? null : e.bool(k) ? 1 : 0);
  const verifiedClicks = e.num('gsc.clicks_28d');
  const visibility = parts([
    [e.num('dataforseo.ranking_keywords') === null ? null : logScore(e.num('dataforseo.ranking_keywords')!, 5), 0.4],
    [e.num('dataforseo.estimated_organic_visits') === null ? null : logScore(e.num('dataforseo.estimated_organic_visits')!, 6), 0.3],
    [e.num('dataforseo.avg_position') === null ? null : clamp01(1 - (e.num('dataforseo.avg_position')! - 1) / 99), 0.1],
    [verifiedClicks === null ? null : logScore(verifiedClicks, 6), 0.2],
  ]);
  const titleLen = e.num('crawler.title_length');
  const descLen = e.num('crawler.meta_description_length');
  const h1 = e.num('crawler.h1_count');
  const technical = parts([
    [b('crawler.indexable'), 0.25],
    [b('crawler.crawlable'), 0.2],
    [b('crawler.https'), 0.15],
    [titleLen === null ? null : titleLen >= 10 && titleLen <= 65 ? 1 : titleLen > 0 ? 0.5 : 0, 0.1],
    [descLen === null ? null : descLen >= 50 && descLen <= 165 ? 1 : descLen > 0 ? 0.5 : 0, 0.1],
    [b('crawler.canonical_valid'), 0.1],
    [h1 === null ? null : h1 === 1 ? 1 : h1 > 1 ? 0.6 : 0, 0.1],
  ]);
  const ps = avg([e.num('pagespeed.performance_mobile'), e.num('pagespeed.performance_desktop')]);
  const cwv = e.str('pagespeed.core_web_vitals');
  const performance = parts([
    [ps === null ? null : ps / 100, 0.8],
    [cwv === null ? null : ({ FAST: 1, AVERAGE: 0.5, SLOW: 0 } as Record<string, number>)[cwv] ?? null, 0.2],
  ]);
  const pages = e.num('crawler.sitemap_urls');
  const words = e.num('crawler.word_count');
  const h2 = e.num('crawler.h2_count');
  const content = parts([
    [pages === null ? null : logScore(pages, 4), 0.35],
    [words === null ? null : clamp01(words / 1200), 0.25],
    [h2 === null ? null : clamp01(h2 / 6), 0.2],
    [b('crawler.structured_data'), 0.2],
  ]);
  const age = e.num('rdap.domain_age_years');
  const risk = parts([
    [age === null ? null : clamp01(age / 10), 0.4],
    [e.str('rdap.status') === null ? null : /active|ok/i.test(e.str('rdap.status')!) ? 1 : 0.3, 0.2],
    [b('crawler.http_ok'), 0.25],
    [e.num('crawler.redirect_hops') === null ? null : e.num('crawler.redirect_hops')! <= 1 ? 1 : e.num('crawler.redirect_hops')! <= 3 ? 0.6 : 0.2, 0.15],
  ]);
  return { visibility, technical, performance, content, risk };
}

export type Result = {
  qualityScore: number | null;
  breakdown: { category: Category; label: string; weight: number; score: number | null; contributionPct: number }[];
  evidenceCoveragePct: number;
  monetary: { low: number; high: number; currency: string; earnings: number; multipleLow: number; multipleHigh: number; comparableIds: string[]; riskAdjusted: boolean } | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  limitations: string[];
};

const monthsBetween = (a: Date, b: Date) => (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
const round = (n: number) => {
  const step = n < 10_000 ? 100 : n < 100_000 ? 500 : n < 1_000_000 ? 5_000 : 50_000;
  return Math.max(0, Math.round(n / step) * step);
};

export function calculate(ev: Evidence[], c: ValuationConfig, fin: FinancialInputs = {}, now = new Date()): Result {
  const scores = categoryScores(ev);
  const limitations: string[] = [];
  const enabled = CATEGORIES.filter((k) => c.weights[k] > 0);
  const totalW = enabled.reduce((t, k) => t + c.weights[k], 0) || 1;
  const withData = enabled.filter((k) => scores[k] !== null);
  const coveredW = withData.reduce((t, k) => t + c.weights[k], 0);
  const coverage = Math.round((coveredW / totalW) * 100);
  const qualityScore = coverage >= c.minEvidencePct && coveredW > 0 ? Math.round((withData.reduce((t, k) => t + c.weights[k] * (scores[k] as number), 0) / coveredW) * 100) : null;
  if (qualityScore === null) limitations.push(`Not enough evidence for a quality score (${coverage}% of weighted categories have data; ${c.minEvidencePct}% required).`);
  for (const k of enabled) if (scores[k] === null) limitations.push(`${CATEGORY_LABELS[k]}: no evidence was available.`);
  const contribTotal = withData.reduce((t, k) => t + c.weights[k] * (scores[k] as number), 0);
  const breakdown = CATEGORIES.map((k) => ({
    category: k,
    label: CATEGORY_LABELS[k],
    weight: c.weights[k],
    score: scores[k] === null ? null : Math.round((scores[k] as number) * 100),
    contributionPct: contribTotal && scores[k] !== null ? Math.round(((c.weights[k] * (scores[k] as number)) / contribTotal) * 100) : 0,
  }));

  // Step B — monetary range only with an earnings basis and dated comparables.
  const earnings =
    typeof fin.ttmProfit === 'number' && fin.ttmProfit !== null ? fin.ttmProfit : typeof fin.ttmRevenue === 'number' && typeof fin.ttmExpenses === 'number' ? fin.ttmRevenue - fin.ttmExpenses : null;
  const model = (fin.businessModel ?? '').trim().toLowerCase();
  const usable = c.comparables.filter((m) => {
    const d = new Date(`${m.observedAt}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && monthsBetween(d, now) <= c.comparableMaxAgeMonths && (m.businessModel.toLowerCase() === 'any' || (model && m.businessModel.toLowerCase() === model));
  });
  let monetary: Result['monetary'] = null;
  if (earnings === null) limitations.push('Financial evidence unavailable: no trailing-12-month earnings were provided.');
  else if (earnings <= 0) limitations.push('Reported trailing-12-month earnings are not positive, so no earnings-based range applies.');
  if (!usable.length) limitations.push(c.comparables.length ? `No current comparable transactions (within ${c.comparableMaxAgeMonths} months) match this business model.` : 'No comparable transaction multiples are configured.');
  if (earnings !== null && earnings > 0 && usable.length) {
    const lo = Math.min(...usable.map((m) => m.multipleLow));
    const hi = Math.max(...usable.map((m) => m.multipleHigh));
    const riskAdjusted = qualityScore !== null && qualityScore < c.riskAdjustment.belowScore && c.riskAdjustment.pct > 0;
    const f = riskAdjusted ? 1 - c.riskAdjustment.pct / 100 : 1;
    monetary = { low: round(earnings * lo * f), high: round(earnings * hi * f), currency: c.currency, earnings: Math.round(earnings), multipleLow: lo, multipleHigh: hi, comparableIds: usable.map((m) => m.id), riskAdjusted };
    limitations.push('Earnings are self-reported and have not been independently verified.');
    if (riskAdjusted) limitations.push(`Range reduced by ${c.riskAdjustment.pct}% for documented quality and stability risk.`);
  }
  if (!monetary) limitations.unshift('Insufficient evidence for a monetary valuation.');

  const verifiedTraffic = ev.some((x) => (x.source === 'gsc' || x.source === 'ga4') && x.status === 'available');
  if (!verifiedTraffic) limitations.push('Traffic figures are third-party estimates, not measured visitors.');
  const confidence: Result['confidence'] = monetary && verifiedTraffic ? 'MEDIUM' : 'LOW';
  return { qualityScore, breakdown, evidenceCoveragePct: coverage, monetary, confidence, limitations: [...new Set(limitations)] };
}

/** Plain-language strengths and improvement areas from category scores. */
export function insights(r: Result) {
  const strong: string[] = [];
  const weak: string[] = [];
  for (const b of r.breakdown) {
    if (b.score === null) continue;
    if (b.score >= 70) strong.push(`${b.label} is strong (${b.score}/100).`);
    else if (b.score < 50) weak.push(`${b.label} needs work (${b.score}/100).`);
  }
  const ideas: Record<Category, string> = {
    visibility: 'Grow organic visibility: target more relevant keywords and improve rankings.',
    technical: 'Fix technical issues: indexability, titles, descriptions, canonicals and headings.',
    performance: 'Improve page speed and Core Web Vitals.',
    content: 'Expand content depth, heading structure and structured data.',
    risk: 'Reduce risk: keep registration current, avoid redirect chains and errors.',
  };
  const opportunities = [...r.breakdown].filter((b) => b.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).map((b) => ideas[b.category]);
  return { strengths: strong, improvements: weak, opportunities };
}
