import Link from 'next/link';
import { Webhook } from 'lucide-react';
import { DataTable, KeyValue, Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime } from '@/lib/admin-data';

export const metadata = { title: 'Webhook Diagnostics' };

type Status = 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED';
type Diagnostics = {
  lastReceivedAt: string | null;
  last7Days: Record<Status, number>;
  types: { eventType: string; count: number }[];
  events: { id: string; provider: string; providerEventId: string; eventType: string; status: Status; attemptCount: number; lastError: string | null; receivedAt: string; processedAt: string | null }[];
  signing: { platform: boolean; connect: boolean };
};

const TONE = { RECEIVED: 'blue', PROCESSING: 'blue', PROCESSED: 'green', FAILED: 'red', IGNORED: 'slate' } as const;
const LABEL: Record<Status, string> = { RECEIVED: 'Queued', PROCESSING: 'Processing', PROCESSED: 'Processed', FAILED: 'Failed', IGNORED: 'Ignored' };
const FILTERS: (Status | '')[] = ['', 'FAILED', 'PROCESSED', 'IGNORED', 'RECEIVED'];

/** Webhook diagnostics (V2 guide §1.4 provider health). Payloads stay server-side; only metadata is shown. */
export default async function WebhookDiagnostics({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = '' } = await searchParams;
  const d = await adminGet<Diagnostics>(`/admin/webhooks${status ? `?status=${encodeURIComponent(status)}` : ''}`);
  return (
    <>
      <AdminHeader section="System Operations" parent={{ label: 'System Health', href: '/admin/health' }} title="Webhook Diagnostics" description="Stripe deliveries received by AmpliVerify, how each was processed, and errors to fix." />
      {!d ? (
        <Panel>
          <StateView kind="error" icon={<Webhook size={36} />} title="Webhook data could not be loaded with your permissions." description="Viewing diagnostics needs the system.read permission." />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Last 7 days">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {(['PROCESSED', 'FAILED', 'IGNORED', 'RECEIVED'] as Status[]).map((k) => (
                <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                  <small style={{ color: 'var(--muted)' }}>{LABEL[k]}</small>
                  <b style={{ display: 'block', fontSize: 24, color: k === 'FAILED' && d.last7Days.FAILED ? 'var(--red, #b42318)' : 'var(--heading)' }}>{d.last7Days[k] ?? 0}</b>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <KeyValue label="Last delivery" value={d.lastReceivedAt ? dateTime(d.lastReceivedAt) : 'None received yet'} />
              <KeyValue label="Platform signing secret" value={d.signing.platform ? 'Set' : 'Missing'} />
              <KeyValue label="Connected-accounts signing secret" value={d.signing.connect ? 'Set' : 'Missing (seller account events are rejected)'} />
            </div>
          </Panel>
          {d.types.length > 0 && (
            <Panel title="Event types (7 days)" bodyless>
              <DataTable columns={['Event type', 'Deliveries']} rows={d.types.map((t) => [<code key="c">{t.eventType}</code>, String(t.count)])} />
            </Panel>
          )}
          <Panel
            title="Recent deliveries"
            bodyless
            actions={
              <nav aria-label="Filter by status" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 14 }}>
                {FILTERS.map((f) => (
                  <Link key={f || 'all'} href={f ? `/admin/health/webhooks?status=${f}` : '/admin/health/webhooks'} aria-current={status === f ? 'page' : undefined} style={{ fontWeight: status === f ? 700 : 500 }}>
                    {f ? LABEL[f] : 'All'}
                  </Link>
                ))}
              </nav>
            }
          >
            <DataTable
              columns={['Received', 'Event', 'Status', 'Attempts', 'Error', '']}
              rows={d.events.map((e) => [
                dateTime(e.receivedAt),
                <span key="e" style={{ display: 'grid' }}>
                  <code>{e.eventType}</code>
                  <small style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>{e.providerEventId}</small>
                </span>,
                <StatusPill key="s" tone={TONE[e.status]}>
                  {LABEL[e.status]}
                </StatusPill>,
                String(e.attemptCount),
                e.lastError ? <small key="x" style={{ overflowWrap: 'anywhere' }}>{e.lastError.slice(0, 240)}</small> : '—',
                e.status === 'FAILED' ? (
                  <ActionButton key="r" path={`/admin/webhooks/${e.id}/retry`} size="sm" variant="outline" successMessage="Queued for retry.">
                    Retry
                  </ActionButton>
                ) : (
                  ''
                ),
              ])}
              empty="No webhook deliveries match this filter."
            />
          </Panel>
        </div>
      )}
    </>
  );
}
