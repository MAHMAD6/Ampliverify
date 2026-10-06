import { FileText, Settings, Shield, User } from 'lucide-react';
import { AuditList } from '@/components/admin/AuditList';
import { categoryOf, loadAudit, type AuditFilters } from '@/lib/audit';

export const metadata = { title: 'Audit Logs' };

/** Audit Logs (chat design 2026-10-06; final-batch1/03). Every server-generated audit record. */
export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  const filters = await searchParams;
  const audit = await loadAudit();
  const n = (cat: string) => (audit.ok ? audit.records.filter((r) => categoryOf(r.eventType) === cat).length : undefined);
  return (
    <AuditList
      title="Audit Logs"
      description="A chronological record of important system events, changes, and administrative actions."
      about={{ title: 'About Audit Logs', text: 'Key system events and administrative actions. Filter by event type or date range and open any event for its full context, including IP address.' }}
      metrics={[
        { label: 'Total Events', icon: <FileText size={24} />, tone: 'blue', value: audit.ok ? audit.records.length : undefined, note: audit.ok ? 'Most recent 500 records' : 'No data available yet' },
        { label: 'User Events', icon: <User size={24} />, tone: 'green', value: n('tenant') },
        { label: 'System Events', icon: <Settings size={24} />, tone: 'purple', value: n('system') },
        { label: 'Security Events', icon: <Shield size={24} />, tone: 'amber', value: n('access') },
      ]}
      records={audit.records}
      actors={audit.actors}
      filters={filters}
      basePath="/admin/audit-logs"
      emptyTitle="No audit log records yet"
      footnote="Audit records are append-only. Additional details, including IP address and full event context, are in the event detail view."
    />
  );
}
