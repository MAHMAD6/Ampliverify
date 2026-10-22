import { apiGet } from './api';

/** The two balances (Hybrid pricing): SEO audit allowance and AI/GEO credits. */
export type Balances = {
  seoAudits: { limit: number | null; used: number; reserved: number; remaining: number | null; maxPagesPerAudit: number | null; periodStart: string };
  credits: { available: number; reserved: number; subscription: number; purchased: number; other: number; expiringSoon: number; nextExpiry: string | null };
  prices: Record<string, number>;
};

export type Quote = { featureKey: string; units: number; cost: number; available: number; reserved: number; after: number; sufficient: boolean };

export async function getBalances(workspaceId: string | null) {
  if (!workspaceId) return null;
  const r = await apiGet<Balances>(`/user/workspaces/${workspaceId}/balances`, { auth: true });
  return r.ok ? r.data : null;
}

export async function getQuote(workspaceId: string | null, featureKey: string, units = 1) {
  if (!workspaceId) return null;
  const r = await apiGet<Quote>(`/user/workspaces/${workspaceId}/credits/quote?featureKey=${encodeURIComponent(featureKey)}&units=${units}`, { auth: true });
  return r.ok ? r.data : null;
}

/** "Uses 10 credits · 340 → 330" — shown before running a metered action. */
export function quoteText(q: Quote | null) {
  if (!q) return null;
  if (q.cost <= 0) return 'Included in your plan (no credits).';
  if (!q.sufficient) return `Needs ${q.cost} credits — you have ${q.available}. Buy credits or wait for your next plan grant.`;
  return `Uses ${q.cost} credit${q.cost === 1 ? '' : 's'} · balance ${q.available} → ${q.after} after completion.`;
}
