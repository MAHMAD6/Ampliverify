/** Mirrors apps/api/src/valuation/valuation-engine.ts ValuationConfig (V1 manual §06). */
export const CATEGORIES = ['visibility', 'technical', 'performance', 'content', 'risk'] as const;
export type Category = (typeof CATEGORIES)[number];
export const SOURCES = ['crawler', 'pagespeed', 'rdap', 'dataforseo', 'gsc', 'ga4'] as const;
export type SourceKey = (typeof SOURCES)[number];
export type AccessLevel = 'off' | 'public' | 'enhanced';

export type Comparable = { id: string; label: string; businessModel: string; multipleLow: number; multipleHigh: number; observedAt: string; source: string };

export type Config = {
  weights: Record<Category, number>;
  minEvidencePct: number;
  comparables: Comparable[];
  comparableMaxAgeMonths: number;
  riskAdjustment: { belowScore: number; pct: number };
  currency: string;
  cacheHours: { pagespeed: number; rankings: number; rdap: number; crawler: number };
  sources: Record<SourceKey, boolean>;
  access: Record<string, AccessLevel>;
  limits: { anonymousPerDay: number; anonymousPerDomainPerDay: number; userPerMonth: number; pdfPerMonth: number };
  enhancedCredits: number;
  consentVersion: string;
  resultTtlDays: number;
  calculator: { enabled: boolean; country: string; language: string };
  disclaimer: string;
};

export type VersionRow = { id: string; version: string; checksum: string; approver: string; note: string | null; effectiveAt: string; current: boolean };

export type AdminConfigPayload = {
  version: string;
  config: Config;
  defaults: Config;
  categoryLabels: Record<Category, string>;
  sourceLabels: Record<SourceKey, string>;
  plans: { code: string; name: string }[];
  versions: VersionRow[];
};

export type SourceRow = { key: SourceKey; label: string; enabled: boolean; configured: boolean; note: string; classification: string; requests30d: number; lastSync: string | null };
export type HistoryRow = {
  id: string;
  domain: string;
  kind: string;
  status: string;
  qualityScore: number | null;
  confidence: string | null;
  valueLow: number | null;
  valueHigh: number | null;
  currency: string;
  methodologyVersion: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  user: string | null;
};

export const CATEGORY_HINTS: Record<Category, string> = {
  visibility: 'Ranking keywords, estimated organic visits and positions; verified clicks when Search Console is connected',
  technical: 'Indexability, crawlability, HTTPS, canonical, redirects, titles and headings',
  performance: 'PageSpeed Insights mobile and desktop scores, Core Web Vitals',
  content: 'Word count, structured data, sitemap pages and heading structure',
  risk: 'Domain age and registration status, robots.txt blocks, HTTPS',
};

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  off: 'No access',
  public: 'Public-data estimate',
  enhanced: 'Estimate + enhanced valuation',
};

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
