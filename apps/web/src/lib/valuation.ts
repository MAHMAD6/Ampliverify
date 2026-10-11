/** Shapes returned by the valuation API (see apps/api/src/valuation). */

export type TrendPoint = { month: string; value: number };
export type SourceState = 'verified' | 'estimated' | 'unavailable' | 'disabled';
export type AccessLevel = 'off' | 'limited' | 'full' | 'full_api';

export type ValuationReport = {
  id: string;
  domain: string;
  kind: 'ESTIMATE' | 'VERIFIED';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  parentId: string | null;
  verifiedChild: { id: string; status: string } | null;
  access: AccessLevel;
  showRange: boolean;
  exports: { pdf: boolean; json: boolean };
  disclaimer: string;
  verifiedValuation: boolean;
  result: null | {
    valueLow: number;
    valueHigh: number;
    valueMid: number;
    currency: string;
    confidence: number;
    confidenceLabel: string;
    confidenceParts: { coverage: number; reliability: number; freshness: number; consistency: number };
    method: 'traffic' | 'traffic+revenue';
    screenshot: string | null;
    metrics: {
      organicTraffic: number | null;
      organicTrafficVerified: boolean;
      trafficGrowthPct: number | null;
      referringDomains: number | null;
      backlinkGrowthPct: number | null;
      domainAuthority: number | null;
      contentPages: number | null;
      socialTraffic: number | null;
    };
    breakdown: { label: string; factor: string; contributionPct: number; score: number | null }[] | null;
    drivers: string[];
    risks: string[];
    sources: { key: string; label: string; state: SourceState }[];
    detail: null | {
      traffic: { organicVisits: number | null; rankingKeywords: number | null; avgPosition: number | null; trend: TrendPoint[]; keywordTrend: TrendPoint[] } | null;
      backlinks: { referringDomains: number | null; totalBacklinks: number | null; domainAuthority: number | null; trend: TrendPoint[] } | null;
      content: { pages: number | null; rankingKeywords: number | null; relevance: number | null } | null;
      social: { visits: number | null; share: number | null; sources: { source: string; visits: number; share: number }[]; trend: TrendPoint[]; verified: boolean } | null;
      technical: { pagespeedMobile: number | null; pagespeedDesktop: number | null; coreWebVitals: 'good' | 'needs_improvement' | 'poor' | null; crawlable: boolean | null; indexable: boolean | null; mobileFriendly: boolean | null; https: boolean | null } | null;
      domain: { ageYears: number | null; registeredAt: string | null; status: string | null; authority: number | null; tld: string } | null;
      opportunities: string[] | null;
    };
  };
};

export type ValuationConfig = { enabled: boolean; available: boolean; verifiedValuation: boolean; showRange: boolean; currency: string; freePerMonth: number; disclaimer: string };

export function money(n: number | null | undefined, currency = 'USD') {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

/** 12400 → "12.4K". */
export function compact(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, (mo || 1) - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

export const SOURCE_STATE_LABEL: Record<SourceState, string> = { verified: 'Verified', estimated: 'Estimated', unavailable: 'Unavailable', disabled: 'Off' };

export const VALUATION_TABS = [
  ['overview', 'Overview'],
  ['traffic', 'Traffic & Search'],
  ['backlinks', 'Backlinks'],
  ['content', 'Content'],
  ['social', 'Social Media'],
  ['technical', 'Technical Health'],
  ['domain', 'Domain'],
  ['breakdown', 'Value Breakdown'],
  ['opportunities', 'Opportunities'],
] as const;

export const BUSINESS_MODELS = ['Content / Advertising', 'Affiliate', 'E-commerce', 'SaaS / Subscription', 'Lead generation', 'Services', 'Marketplace', 'Other'];
export const INDUSTRIES = ['Technology', 'Finance', 'Health', 'Education', 'Travel', 'Retail', 'Real estate', 'Media & Entertainment', 'B2B Services', 'Other'];
export const AUDIENCES = ['Consumers (B2C)', 'Businesses (B2B)', 'Both', 'Local customers', 'Global audience'];
export const MARGINS = [
  ['0-10', '0–10%'],
  ['10-20', '10–20%'],
  ['20-30', '20–30%'],
  ['30-50', '30–50%'],
  ['50-100', 'Over 50%'],
] as const;
export const TRAFFIC_SOURCES = ['Google Analytics', 'Server logs', 'Other analytics', 'Estimate'];
