/** Shapes returned by the valuation API (apps/api/src/valuation; V1 manual §06). */

export type TrendPoint = { month: string; value: number };
export type Classification = 'observed' | 'modeled' | 'verified' | 'self_reported' | 'public_record';
export type ValuationStatus = 'queued' | 'collecting' | 'normalizing' | 'calculating' | 'completed' | 'failed' | 'cancelled' | 'expired';

export type ValuationReport = {
  id: string;
  domain: string;
  mode: 'public' | 'enhanced' | 'test';
  status: ValuationStatus;
  error: string | null;
  parentId: string | null;
  createdAt: string;
  asOf: string | null;
  expiresAt: string | null;
  methodologyVersion: string | null;
  currency: string;
  qualityScore: number | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  evidenceCoveragePct: number | null;
  monetaryRange: { low: number; high: number; currency: string; earnings: number; multipleLow: number; multipleHigh: number; riskAdjusted: boolean } | null;
  breakdown: { category: string; label: string; weight: number; score: number | null; contributionPct: number }[] | null;
  limitations: string[];
  strengths: string[];
  improvements: string[];
  opportunities: string[];
  trend: TrendPoint[];
  screenshot: string | null;
  methodology: { version: string; weights: Record<string, number>; minEvidencePct: number } | null;
  owner: boolean;
  shareToken: string;
  verifiedChild: { id: string; status: ValuationStatus; shareToken: string } | null;
  enhancedCredits: number;
  consentVersion: string;
  disclaimer: string;
};

export type EvidenceRow = {
  source: string;
  sourceLabel: string;
  metric: string;
  label: string;
  value: number | string | boolean | null;
  unit: string | null;
  classification: Classification;
  status: 'available' | 'unavailable';
  observedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  missingReason: string | null;
};

export type ValuationConfig = {
  enabled: boolean;
  available: boolean;
  consentVersion: string;
  methodologyVersion: string;
  weights: Record<string, number>;
  anonymousPerDay: number;
  enhancedCredits: number;
  currency: string;
  disclaimer: string;
  sources: { key: string; label: string }[];
};

export const RUNNING: ValuationStatus[] = ['queued', 'collecting', 'normalizing', 'calculating'];
export const STATUS_LABEL: Record<ValuationStatus, string> = {
  queued: 'Queued',
  collecting: 'Collecting evidence',
  normalizing: 'Normalizing signals',
  calculating: 'Calculating',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const CLASS_LABEL: Record<Classification, string> = {
  observed: 'Observed',
  modeled: 'Modeled estimate',
  verified: 'Verified',
  self_reported: 'Self-reported',
  public_record: 'Public record',
};

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

export function displayValue(e: Pick<EvidenceRow, 'value' | 'unit'>) {
  if (e.value === null) return '—';
  if (typeof e.value === 'boolean') return e.value ? 'Yes' : 'No';
  const v = typeof e.value === 'number' ? e.value.toLocaleString('en-US') : e.value;
  return e.unit ? `${v} ${e.unit}` : String(v);
}

export function reportHref(id: string, token: string) {
  return `/website-value/report/${id}?t=${encodeURIComponent(token)}`;
}

export const BUSINESS_MODELS = ['content', 'affiliate', 'ecommerce', 'saas', 'lead-generation', 'services', 'marketplace', 'other'];
export const BUSINESS_MODEL_LABEL: Record<string, string> = {
  content: 'Content / Advertising',
  affiliate: 'Affiliate',
  ecommerce: 'E-commerce',
  saas: 'SaaS / Subscription',
  'lead-generation': 'Lead generation',
  services: 'Services',
  marketplace: 'Marketplace',
  other: 'Other',
};
