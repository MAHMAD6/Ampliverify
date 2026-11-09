/** Shapes returned by the Digital Assets API (apps/api/src/assets; V2 guide §2). */

export type Relationship = 'OWNED' | 'MANAGED' | 'AUTHORIZED' | 'PROSPECTIVE';
export type OwnershipStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export const RELATIONSHIPS: { value: Relationship; label: string; hint: string }[] = [
  { value: 'OWNED', label: 'I own it', hint: 'You or your company own this asset.' },
  { value: 'MANAGED', label: 'I manage it', hint: 'You run it for the owner (agency, operator).' },
  { value: 'AUTHORIZED', label: 'I am authorized', hint: 'The owner gave you access to analyse or improve it.' },
  { value: 'PROSPECTIVE', label: 'Considering buying it', hint: 'A prospective acquisition. It is never treated as owned.' },
];
export const relationshipLabel = (r: string) => RELATIONSHIPS.find((x) => x.value === r)?.label ?? r;

export const OWNERSHIP: Record<OwnershipStatus, { label: string; tone?: 'blue' | 'green' | 'amber' }> = {
  UNVERIFIED: { label: 'Not verified' },
  PENDING: { label: 'Verification pending', tone: 'amber' },
  VERIFIED: { label: 'Verified', tone: 'green' },
  REJECTED: { label: 'Verification failed', tone: 'amber' },
};

export const ANALYSIS_CHECKS: { value: string; label: string }[] = [
  { value: 'seo', label: 'SEO health' },
  { value: 'traffic', label: 'Traffic signals' },
  { value: 'technical', label: 'Technical quality' },
  { value: 'content', label: 'Content quality' },
  { value: 'domain', label: 'Domain profile' },
  { value: 'valuation', label: 'Valuation estimate' },
];

type ValuationRow = { id?: string; domain?: string; kind?: string; status: string; qualityScore: number | null; confidenceGrade?: string | null; valueLow: number | null; valueHigh: number | null; currency: string; createdAt?: string; completedAt?: string | null };

export type Asset = {
  id: string;
  name: string;
  url: string | null;
  domain: string | null;
  assetType: string;
  relationship: Relationship;
  ownershipStatus: OwnershipStatus;
  verifiedMethod: string | null;
  verifiedAt: string | null;
  description: string | null;
  category: string | null;
  acquiredAt: string | null;
  purchasePriceMinor: number | null;
  currency: string;
  project: { id: string; name: string; status?: string } | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AssetDetail = Asset & {
  verificationToken: string;
  verification: { dnsRecord: { type: string; host: string; value: string }; metaTag: string; file: { path: string; content: string } } | null;
  evidence: { id: string; method: string; status: string; detail: string | null; filename: string | null; createdAt: string }[];
  financials: { id: string; month: string; revenueMinor: number; costMinor: number; source: string; note: string | null }[];
  valuations: ValuationRow[];
  analyses: { id: string; createdAt: string; valuationId: string | null }[];
  tasks: Record<string, number>;
};
export type AssetSummary = {
  totalAssets: number;
  owned: number;
  managed: number;
  authorized: number;
  prospective: number;
  verification: Partial<Record<OwnershipStatus, number>>;
  activeProjects: number;
  linkedProjects: number;
  analyses: number;
  estimatedValue: { low: number; high: number; currency: string; assetsValued: number } | null;
};
export type AssetPerformance = Asset & {
  latestValuation: ValuationRow | null;
  previousValuation: ValuationRow | null;
  valuationCount: number;
  last12Months: { months: number; revenueMinor: number; costMinor: number; profitMinor: number; source: string } | null;
  tasks: Record<string, number>;
};
export type AnalysisRow = { id: string; url: string; domain: string; assetType: string; askingPriceMinor: number | null; currency: string; checks: string[]; assetId: string | null; valuation: ValuationRow | null; createdAt: string };

/** Valuation figures are whole currency units. */
export function range(v: { valueLow: number | null; valueHigh: number | null; currency: string } | null | undefined) {
  if (!v || v.valueLow === null || v.valueHigh === null) return '—';
  const f = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: v.currency || 'USD', maximumFractionDigits: 0 });
  return `${f(v.valueLow)} – ${f(v.valueHigh)}`;
}
export const verifyLabel = (m: string | null) => ({ DNS_TXT: 'DNS TXT record', META_TAG: 'Meta tag', HTML_FILE: 'Verification file', DOCUMENT: 'Document review' })[m ?? ''] ?? m ?? '—';
