import 'server-only';
import { apiGet } from './api';

export type AdminUser = { id: string; email: string; displayName: string | null; status: string; createdAt: string; updatedAt: string };
export type AdminRole = { id: string; key: string; name: string; description: string | null; isSystem: boolean; permissions: { permission: { key: string } }[] };
export type AdminAssignment = {
  id: string;
  user: { id: string; email: string; displayName: string | null; status: string };
  role: { id: string; key: string; name: string };
  scopeType: 'GLOBAL' | 'ORGANIZATION' | 'WORKSPACE' | 'PROJECT';
  organizationId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  createdBy: string;
  createdAt: string;
};

/** Super Admin reads; each resolves to null when the API refuses or is unavailable (pages then show "—"). */
export async function loadUsers() {
  const r = await apiGet<AdminUser[]>('/admin/users?limit=500', { auth: true });
  return r.ok ? r.data : null;
}
export async function loadRoles() {
  const r = await apiGet<AdminRole[]>('/admin/roles', { auth: true });
  return r.ok ? r.data : null;
}
export async function loadAssignments() {
  const r = await apiGet<AdminAssignment[]>('/admin/access-assignments?limit=500', { auth: true });
  return r.ok ? r.data : null;
}

export const ADMIN_ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN'];
export const SUB_ADMIN_ROLE_KEYS = ['SUB_ADMIN'];

export const dateTime = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
export const date = (iso: string) => new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
export const userLabel = (u: { displayName: string | null; email: string }) => u.displayName || u.email;
export const scopeLabel = (a: Pick<AdminAssignment, 'scopeType'>) => ({ GLOBAL: 'Platform', ORGANIZATION: 'Organization', WORKSPACE: 'Workspace', PROJECT: 'Project' })[a.scopeType];

export function matchesQ(q: string | undefined, ...values: (string | null | undefined)[]) {
  const t = q?.trim().toLowerCase();
  return !t || values.some((v) => v?.toLowerCase().includes(t));
}

export type ModuleControlRow = { moduleKey: string; enabled: boolean; updatedAt: string; updater: { id: string; email: string; displayName: string | null } | null };
export type FeatureFlagRow = { id: string; key: string; enabled: boolean; description: string; environment: string; updatedAt: string; rules: { scopeType: string; scopeValue: string; percentage: string | null }[] };

export async function loadModuleControls() {
  const r = await apiGet<ModuleControlRow[]>('/admin/module-controls', { auth: true });
  return r.ok ? r.data : null;
}
export async function loadFeatureFlags() {
  const r = await apiGet<FeatureFlagRow[]>('/admin/feature-flags', { auth: true });
  return r.ok ? r.data : null;
}

// ── Commerce (admin) ──────────────────────────────────────────────────────

export type AdminFeature = { id: string; key: string; name: string; moduleKey: string | null; description: string | null; valueType: 'BOOLEAN' | 'LIMIT' | 'CONFIG' };
export type AdminPlanPrice = { id: string; billingInterval: 'MONTHLY' | 'ANNUAL'; currency: string; amountMinor: string; providerPriceId: string | null; active: boolean; createdAt: string };
export type AdminPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isPublic: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  prices: AdminPlanPrice[];
  entitlements: { id: string; enabled: boolean; limitNumeric: string | null; configJson: unknown; feature: AdminFeature }[];
  _count: { subscriptions: number };
};
export type AdminWorkspace = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  organization: { id: string; name: string };
  creditWallet: { balanceCache: string } | null;
  subscriptions: { id: string; status: string; plan?: { code: string; name: string } }[];
  _count: { projects: number; memberships: number };
};

export async function adminGet<T>(path: string) {
  const r = await apiGet<T>(path, { auth: true });
  return r.ok ? r.data : null;
}

export const SUB_TONE = { ACTIVE: 'green', TRIALING: 'blue', PAST_DUE: 'red', CANCELED: 'slate', INCOMPLETE: 'amber' } as const;
export const INVOICE_TONE = { PAID: 'green', OPEN: 'amber', DRAFT: 'slate', VOID: 'slate', UNCOLLECTIBLE: 'red' } as const;
