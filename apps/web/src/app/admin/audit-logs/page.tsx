import { CircleCheck, ScrollText } from 'lucide-react';
import { Button, EmptyState, KeyValue, Notice, Panel } from '@/components/ui';
import { AdminHeader, MetricRow } from '@/components/admin/AdminParts';
import { AuditTable } from '@/components/admin/AuditTable';
import { filterRecords, isSensitive, loadAudit, type AuditFilters } from '@/lib/audit';
import s from '@/components/admin/audit.module.css';

export const metadata = { title: 'Audit Logs' };

/**
 * Audit Logs (admin-final-batch1/03): every server-generated audit record
 * (`GET /admin/audit-logs`). The schema records no outcome per event, so
 * "Failed Actions" and the outcome filter are not shown as data.
 */
export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  const filters = await searchParams;
  const audit = await loadAudit();
  const rows = filterRecords(audit.records, filters);
  const loaded = audit.ok;

  return (
    <>
      <AdminHeader
        section="System Operations"
        title="Audit Logs"
        description="Inspect server-generated audit records for consequential and security-relevant actions."
        actions={
          <Button variant="outline" disabled title="Exports must themselves be audited; available once the export endpoint exists.">
            Export Audit Log
          </Button>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="neutral" title="Audit integrity:">
          Records are server-generated, append-only at the database layer, and readable only with the audit permission.
        </Notice>
      </div>
      <MetricRow
        items={[
          { label: 'Audit Events', value: loaded ? audit.records.length : undefined, note: loaded ? 'Most recent 500 records' : 'No audit data loaded' },
          { label: 'Sensitive Changes', value: loaded ? audit.records.filter(isSensitive).length : undefined, note: loaded ? 'User, role and access changes' : 'No sensitive events' },
          { label: 'Failed Actions', note: 'Outcomes are not recorded yet' },
          { label: 'Retention', note: 'Not configured' },
        ]}
      />
      <Panel title="Audit Log" description="Search immutable records of security, billing, access, and administrative changes." bodyless>
        <AuditTable
          records={rows}
          filters={filters}
          actors={audit.actors}
          detailBase="/admin/audit-logs"
          searchLabel="Search actor, target, action, or reference..."
          actorFilter={false}
          empty={
            <EmptyState
              icon={<ScrollText size={26} />}
              title={audit.records.length && rows.length === 0 ? 'No records match your filters' : 'No audit events available'}
              description="Server-generated audit events will appear here when available."
            />
          }
        />
      </Panel>
      <div className={s.split}>
        <Panel title="Recorded Event Fields" description="Context captured with every audit record." flushHead>
          <KeyValue label="Actor" value="User ID and role" />
          <KeyValue label="Action" value="Normalized event name" />
          <KeyValue label="Target" value="Resource type and ID" />
          <KeyValue label="Change" value="Before / after values where applicable" />
          <KeyValue label="Timestamp" value="Server-generated" />
        </Panel>
        <Panel title="Audit Safeguards" description="How evidentiary value is protected." flushHead>
          <ul className={s.checks}>
            <li>
              <CircleCheck size={16} /> Application users cannot edit or delete audit records (database triggers reject it).
            </li>
            <li>
              <CircleCheck size={16} /> Before/after values are recorded for consequential configuration changes.
            </li>
            <li>
              <CircleCheck size={16} /> Reading the log requires the global audit permission.
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
