import { Clock3, ShieldCheck, User, Users } from 'lucide-react';
import { AuditList } from '@/components/admin/AuditList';
import { loadAssignments, ADMIN_ROLE_KEYS, SUB_ADMIN_ROLE_KEYS } from '@/lib/admin-data';
import { filterRecords, isAdminEvent, loadAudit, type AuditFilters } from '@/lib/audit';

export const metadata = { title: 'Admin Activity' };

/** Admin Activity (chat design 2026-10-06; final-batch1/01). Administrator actions from the append-only audit log. */
export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  const filters = await searchParams;
  const [audit, assignments] = await Promise.all([loadAudit(), loadAssignments()]);
  const admin = audit.records.filter(isAdminEvent);
  const count = (keys: string[]) => (assignments ? new Set(assignments.filter((a) => keys.includes(a.role.key)).map((a) => a.user.id)).size : undefined);
  return (
    <AuditList
      title="Admin Activity"
      description="Recent administrative actions performed by admins and sub-admins."
      about={{ title: 'About Admin Activity', text: 'Key administrative actions such as user management, settings changes, content updates, and access-related actions. IP address and full context are in the detail view.' }}
      metrics={[
        { label: 'Total Admin Actions', icon: <Users size={24} />, tone: 'blue', value: audit.ok ? admin.length : undefined, note: audit.ok ? 'Most recent 500 audit records' : 'No data available yet' },
        { label: 'Admins', icon: <ShieldCheck size={24} />, tone: 'green', value: count(ADMIN_ROLE_KEYS) },
        { label: 'Sub-Admins', icon: <User size={24} />, tone: 'purple', value: count(SUB_ADMIN_ROLE_KEYS) },
        { label: 'Actions in Selected Period', icon: <Clock3 size={24} />, tone: 'amber', value: audit.ok && filters.range ? filterRecords(admin, { range: filters.range }).length : undefined, note: filters.range ? undefined : 'Choose a date range' },
      ]}
      records={admin}
      actors={audit.actors}
      filters={filters}
      basePath="/admin/activity"
      emptyTitle="No admin activity yet"
      footnote="Admin activity data is shown when available. IP address and additional details are available in the activity detail view."
    />
  );
}
