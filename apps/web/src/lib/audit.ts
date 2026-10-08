/** Audit record as returned by `GET /admin/audit-logs` (table `audit_logs`, append-only). */
export type AuditRecord = {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  eventType: string;
  targetType: string;
  targetId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  reason: string | null;
  ipAddress: string | null;
  deviceMetadata: { userAgent?: string } | null;
  requestId: string | null;
  createdAt: string;
};

export type AuditCategory = 'access' | 'billing' | 'system' | 'content' | 'tenant';

/** Event-type prefixes per category (event types are `<resource>.<verb>`). */
const CATEGORY_PREFIXES: Record<AuditCategory, string[]> = {
  access: ['user.', 'role.', 'access.', 'admin.'],
  billing: ['billing.', 'subscription.', 'invoice.', 'credit.', 'plan.'],
  system: ['system.', 'module.', 'flag.', 'settings.', 'ai.'],
  content: ['content.', 'blog.', 'guide.', 'help.', 'job.', 'media.', 'cms.', 'support.'],
  tenant: ['organization.', 'workspace.', 'project.'],
};

export const AUDIT_CATEGORIES: [AuditCategory, string][] = [
  ['access', 'User & role changes'],
  ['billing', 'Billing changes'],
  ['system', 'System operations'],
  ['content', 'Content changes'],
  ['tenant', 'Organizations & projects'],
];

export function categoryOf(eventType: string): AuditCategory | null {
  for (const [cat, prefixes] of Object.entries(CATEGORY_PREFIXES) as [AuditCategory, string[]][]) {
    if (prefixes.some((p) => eventType.startsWith(p))) return cat;
  }
  return null;
}

/**
 * Administrator actions: role and access management, admin-namespaced events,
 * and any event recorded with an actor role (admin endpoints record one).
 */
export function isAdminEvent(r: AuditRecord) {
  return r.eventType.startsWith('role.') || r.eventType.startsWith('access.') || r.eventType.startsWith('admin.') || !!r.actorRole;
}

/** Security-relevant: changes to who can do what. */
export function isSensitive(r: AuditRecord) {
  return categoryOf(r.eventType) === 'access';
}

export const RANGES: [string, string, number][] = [
  ['24h', 'Last 24 hours', 1],
  ['7d', 'Last 7 days', 7],
  ['30d', 'Last 30 days', 30],
  ['90d', 'Last 90 days', 90],
];

export type AuditFilters = { q?: string; category?: string; actor?: string; range?: string };

export function filterRecords(records: AuditRecord[], f: AuditFilters, now = Date.now()) {
  const term = f.q?.trim().toLowerCase();
  const days = RANGES.find(([k]) => k === f.range)?.[2];
  return records.filter(
    (r) =>
      (!term || [r.eventType, r.targetType, r.targetId, r.actorUserId, r.requestId].some((v) => v?.toLowerCase().includes(term))) &&
      (!f.category || categoryOf(r.eventType) === f.category) &&
      (!f.actor || r.actorUserId === f.actor) &&
      (!days || now - new Date(r.createdAt).getTime() <= days * 86_400_000),
  );
}

/** Loads up to 500 recent audit records plus user labels for actors (both need global admin permissions). */
export async function loadAudit() {
  const { apiGet } = await import('./api');
  const [logs, users] = await Promise.all([
    apiGet<AuditRecord[]>('/admin/audit-logs?limit=500', { auth: true }),
    apiGet<{ id: string; email: string; displayName: string | null }[]>('/admin/users?limit=500', { auth: true }),
  ]);
  const actors = new Map<string, string>((users.ok ? users.data : []).map((u) => [u.id, u.displayName || u.email]));
  return { ok: logs.ok, reason: logs.ok ? null : logs.reason, records: logs.ok ? logs.data : [], actors };
}
