import { ListTree } from 'lucide-react';
import { ButtonLink, EmptyState, KeyValue, Notice, Panel } from '../ui';
import { AdminHeader } from './AdminParts';
import { AUDIT_CATEGORIES, categoryOf, type AuditRecord } from '@/lib/audit';
import s from './audit.module.css';

const show = (v: unknown) => (v === null || v === undefined ? undefined : <pre className={s.pre}>{JSON.stringify(v, null, 2)}</pre>);

/**
 * Activity / Security / Audit Event Detail (admin-final-batch3/04): one
 * reusable pattern for Admin Activity and Audit Log records. Fields render
 * only when the record provides them ("Not available" otherwise); the audit
 * log stores no outcome or authentication method yet.
 */
export function EventDetail({ record, actorLabel, related, back }: { record: AuditRecord | null; actorLabel?: string; related: AuditRecord[]; back: { href: string; label: string } }) {
  const r = record;
  const category = r ? AUDIT_CATEGORIES.find(([k]) => k === categoryOf(r.eventType))?.[1] : undefined;
  return (
    <>
      <AdminHeader
        section="System Operations"
        parent={{ label: back.label, href: back.href }}
        page="Event Detail"
        title="Event Detail"
        description="Inspect a single backend-recorded event."
        actions={
          <ButtonLink href={back.href} variant="outline">
            Back to Log
          </ButtonLink>
        }
      />
      {!r && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="neutral">This event could not be loaded. Audit records are readable with the global audit permission.</Notice>
        </div>
      )}
      <div className={s.split} style={{ marginTop: 0 }}>
        <Panel title="Event Summary" description="Core server-recorded event information." flushHead>
          <KeyValue label="Event ID" value={r?.id} />
          <KeyValue label="Event type" value={r ? <code>{r.eventType}</code> : undefined} />
          <KeyValue label="Category" value={category} />
          <KeyValue label="Result" value={undefined} />
          <KeyValue label="Timestamp" value={r ? `${new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC` : undefined} />
          <KeyValue label="Request ID" value={r?.requestId ?? undefined} />
        </Panel>
        <Panel title="Actor & Target" description="Identity and affected resource context." flushHead>
          <KeyValue label="Actor" value={r ? (r.actorUserId ? actorLabel ?? r.actorUserId : 'System') : undefined} />
          <KeyValue label="Actor role" value={r?.actorRole ?? undefined} />
          <KeyValue label="Target type" value={r?.targetType} />
          <KeyValue label="Target ID" value={r?.targetId ?? undefined} />
          <KeyValue label="Organization" value={r?.organizationId ?? undefined} />
          <KeyValue label="Workspace" value={r?.workspaceId ?? undefined} />
        </Panel>
        <Panel title="Security Context" description="Only captured, policy-approved metadata." flushHead>
          <KeyValue label="IP address" value={r?.ipAddress ?? undefined} />
          <KeyValue label="Device / client" value={r?.deviceMetadata?.userAgent} />
          <KeyValue label="Session ID" value={undefined} />
          <KeyValue label="Authentication method" value={undefined} />
        </Panel>
        <Panel title="Change Context" description="For events that alter configuration or data." flushHead>
          <KeyValue label="Previous value" value={show(r?.beforeJson)} />
          <KeyValue label="New value" value={show(r?.afterJson)} />
          <KeyValue label="Reason / note" value={r?.reason ?? undefined} />
        </Panel>
      </div>
      <div style={{ marginTop: 16 }}>
        <Panel title="Related Events" description="Events from the same request or on the same resource." bodyless>
          {related.length === 0 ? (
            <EmptyState icon={<ListTree size={26} />} title="No related events available" description="Only backend-linked records appear here." />
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th aria-label="Details" />
                  </tr>
                </thead>
                <tbody>
                  {related.map((e) => (
                    <tr key={e.id}>
                      <td className={s.nowrap}>{new Date(e.createdAt).toISOString().replace('T', ' ').slice(0, 16)} UTC</td>
                      <td>
                        <code>{e.eventType}</code>
                      </td>
                      <td>{e.targetType}</td>
                      <td>
                        <a href={`${back.href}/${e.id}`} className={s.view}>
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

/** Loads one record from the recent audit window and links events by request or target. */
export async function loadEvent(id: string) {
  const { loadAudit } = await import('@/lib/audit');
  const audit = await loadAudit();
  const record = audit.records.find((r) => r.id === id) ?? null;
  const related = record
    ? audit.records.filter((r) => r.id !== record.id && ((record.requestId && r.requestId === record.requestId) || (record.targetId && r.targetType === record.targetType && r.targetId === record.targetId))).slice(0, 20)
    : [];
  return { loaded: audit.ok, record, related, actorLabel: record?.actorUserId ? audit.actors.get(record.actorUserId) : undefined };
}
