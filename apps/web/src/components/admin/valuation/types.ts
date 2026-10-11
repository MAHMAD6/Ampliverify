/** Mirrors apps/api/src/valuation/valuation-engine.ts ValuationSettings. */
export const FACTORS = ['traffic', 'backlinks', 'content', 'technical', 'social', 'brand'] as const;
export type Factor = (typeof FACTORS)[number];
export const SOURCES = ['ga4', 'gsc', 'dataforseo', 'pagespeed', 'rdap', 'social'] as const;
export type SourceKey = (typeof SOURCES)[number];
export type AccessLevel = 'off' | 'limited' | 'full' | 'full_api';
export const REPORT_SECTIONS = ['traffic', 'backlinks', 'content', 'social', 'technical', 'domain', 'breakdown', 'opportunities'] as const;

export type Settings = {
  weights: Record<Factor, number>;
  multipliers: { min: number; max: number };
  industryAdjustmentPct: number;
  currency: { code: string; rateFromUsd: number };
  showRange: boolean;
  valuePerVisitUsd: number;
  sources: Record<SourceKey, boolean>;
  confidence: { coverage: number; reliability: number; freshness: number; consistency: number };
  thresholds: { low: number; high: number };
  access: Record<string, AccessLevel>;
  limits: { freePerMonth: number; paidPerMonth: number; pdfPerMonth: number; apiAccess: boolean };
  exports: { pdf: boolean; json: boolean };
  features: { verifiedValuation: boolean; opportunities: boolean; socialSection: boolean };
  calculator: { enabled: boolean; cacheHours: number; country: string; language: string };
  report: { sections: Record<(typeof REPORT_SECTIONS)[number], boolean>; disclaimer: string };
};

export type AdminSettingsPayload = {
  settings: Settings;
  defaults: Settings;
  plans: { code: string; name: string }[];
  factorLabels: Record<Factor, string>;
  sourceLabels: Record<SourceKey, string>;
};

export type SourceRow = { key: SourceKey; label: string; enabled: boolean; configured: boolean; note: string; requests30d: number; lastSync: string | null; lastStatus: string | null };
export type ChangeRow = { id: string; at: string; by: string; change: string; current: boolean };
export type HistoryRow = { id: string; domain: string; kind: string; status: string; valueLow: number | null; valueHigh: number | null; valueMid: number | null; currency: string; confidence: number | null; error: string | null; createdAt: string; completedAt: string | null; user: string | null };

export const FACTOR_HINTS: Record<Factor, string> = {
  traffic: 'Organic traffic, keyword value and search visibility',
  backlinks: 'Referring domains, link quality and domain authority',
  content: 'Published pages, content depth and topical relevance',
  technical: 'Core Web Vitals, crawlability, indexability, site health',
  social: 'Traffic from social media and referral sources',
  brand: 'Brand search volume, domain age, industry and market demand',
};

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  off: 'No access',
  limited: 'Limited estimate only',
  full: 'Full estimation + export',
  full_api: 'Full estimation + API access',
};

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'PKR', 'AED'];
