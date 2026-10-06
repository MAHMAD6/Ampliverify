import { CircleCheck, ShieldAlert } from 'lucide-react';
import { Button, EmptyState, KeyValue, Notice, Panel } from '@/components/ui';
import { AdminHeader, MetricRow } from '@/components/admin/AdminParts';
import { AuditTable } from '@/components/admin/AuditTable';
import { filterRecords, isAdminEvent, isSensitive, loadAudit, type AuditFilters } from '@/lib/audit';
import s from '@/components/admin/audit.module.css';

export const metadata = { title: 'Admin Activity' };

/**
 * Admin Activity (admin-final-batch1/01). Administrator actions from the
 * append-only audit log (`GET /admin/audit-logs`, global `audit.read`).
 * Export stays disabled until an audited export endpoint exists.
 */
export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  const filters = await searchParams;
  const audit = await loadAudit();
  const admin = audit.records.filter(isAdminEvent);
  const rows = filterRecords(admin, filters);
  const loaded = audit.ok;

  return (
    <>
      <AdminHeader
        section="System Operations"
        title="Admin Activity"
        description="Review backend-recorded administrator actions."
        actions={
          <Button variant="outline" disabled title="Exports must themselves be audited; available once the export endpoint exists.">
            Export Activity
          </Button>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="neutral" title="Activity visibility:">
          Only real administrator actions captured by the backend are shown.
        </Notice>
      </div>
      <MetricRow
        items={[
          { label: 'Activity Events', value: loaded ? admin.length : undefined, note: loaded ? 'Most recent 500 audit records' : 'No activity data loaded' },
          { label: 'Active Admins', value: loaded ? new Set(admin.map((r) => r.actorUserId).filter(Boolean)).size : undefined, note: loaded ? 'Distinct admins with recorded actions' : 'No activity data loaded' },
          { label: 'Security-Relevant Events', value: loaded ? admin.filter(isSensitive).length : undefined, note: loaded ? 'Role and access changes' : 'No flagged events' },
          { label: 'Changes Requiring Review', note: 'No review workflow yet' },
        ]}
      />
      <Panel title="Administrator Activity" description="Review meaningful administrative actions across the platform." bodyless>
        <AuditTable
          records={rows}
          filters={filters}
          actors={audit.actors}
          detailBase="/admin/activity"
          searchLabel="Search admin, action, target, or reference..."
          actorFilter
          empty={
            <EmptyState
              icon={<ShieldAlert size={26} />}
              title={admin.length && rows.length === 0 ? 'No activity matches your filters' : 'No administrator activity yet'}
              description="Backend-recorded admin actions will appear here with actor, action, target and timestamp."
            />
          }
        />
      </Panel>
      <div className={s.split}>
        <Panel title="Tracked Activity" description="Event categories recorded for administrators." flushHead>
          <KeyValue label="User & role changes" value="Backend-derived" />
          <KeyValue label="Access assignments" value="Backend-derived" />
          <KeyValue label="Billing changes" value="Recorded once the billing admin API exists" />
          <KeyValue label="System operations" value="Recorded once the operations API exists" />
        </Panel>
        <Panel title="Review Rules" description="How activity records stay useful and defensible." flushHead>
          <ul className={s.checks}>
            <li>
              <CircleCheck size={16} /> Actor, target, action and timestamp are recorded in the same transaction as the change.
            </li>
            <li>
              <CircleCheck size={16} /> Records are append-only at the database layer; admins cannot edit or delete them.
            </li>
            <li>
              <CircleCheck size={16} /> Consequential changes require confirmation before they are submitted.
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
