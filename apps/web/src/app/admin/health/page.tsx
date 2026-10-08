import { AlertTriangle, CheckCircle2, Clock3, RotateCw, Server } from 'lucide-react';
import { Field, Input, Panel, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime } from '@/lib/admin-data';

export const metadata = { title: 'System Health' };

type Health = {
  checkedAt: string;
  database: { status: 'UP' | 'DOWN'; latencyMs: number };
  queues: { queue: string; status: string; count: number }[];
  deadJobs: { id: string; queue: string; lastError: string | null; updatedAt: string; attempts: number }[];
  webhooksFailed: number;
  incidents: { id: string; title: string; status: string; startedAt: string; resolvedAt: string | null; publicSummary: string | null }[];
  checks: { id: string; componentKey: string; status: 'HEALTHY' | 'DEGRADED' | 'DOWN'; latencyMs: number | null; checkedAt: string }[];
  providers: { key: string; label: string; configured: boolean }[];
  providerActivity: { provider: string; status: string; count: number; avgLatencyMs: number | null }[];
};

const TONE = { HEALTHY: 'green', DEGRADED: 'amber', DOWN: 'red' } as const;
const INCIDENT = ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'];
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

/**
 * System Health (chat design 2026-10-06): live database check, the latest
 * scheduled component checks, provider configuration and 24h error rates,
 * background queues (with retry for dead jobs) and incidents.
 */
export default async function SystemHealthPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'services' } = await searchParams;
  const h = await adminGet<Health>('/admin/health');
  const latest = [...new Map((h?.checks ?? []).map((c) => [c.componentKey, c])).values()];
  const failing = latest.filter((c) => c.status !== 'HEALTHY').length + (h?.database.status === 'DOWN' ? 1 : 0);
  const openIncidents = (h?.incidents ?? []).filter((i) => i.status !== 'RESOLVED');
  const errors = (p: string) => h?.providerActivity.filter((x) => x.provider === p && x.status === 'error').reduce((n, x) => n + x.count, 0) ?? 0;
  const calls = (p: string) => h?.providerActivity.filter((x) => x.provider === p).reduce((n, x) => n + x.count, 0) ?? 0;

  const rows =
    tab === 'services'
      ? [
          ['Database', 'Core', <StatusPill key="s" tone={h?.database.status === 'UP' ? 'green' : 'red'}>{h?.database.status === 'UP' ? 'Healthy' : 'Down'}</StatusPill>, h ? `${h.database.latencyMs} ms` : '—', h ? dateTime(h.checkedAt) : '—', 'Live check'],
          ...latest
            .filter((c) => c.componentKey !== 'database')
            .map((c) => [label(c.componentKey), 'Core', <StatusPill key="s" tone={TONE[c.status]}>{label(c.status)}</StatusPill>, c.latencyMs === null ? '—' : `${c.latencyMs} ms`, dateTime(c.checkedAt), 'Scheduled check']),
          ...(h?.providers ?? []).map((p) => [
            p.label,
            'Provider',
            <StatusPill key="s" tone={!p.configured ? 'slate' : errors(p.key) ? 'amber' : 'green'}>
              {!p.configured ? 'Not configured' : errors(p.key) ? 'Errors' : 'Configured'}
            </StatusPill>,
            '—',
            '—',
            p.configured ? `${calls(p.key)} calls, ${errors(p.key)} errors (24h)` : 'Set the provider keys to enable',
          ]),
          ['Stripe webhooks', 'Billing', <StatusPill key="s" tone={h?.webhooksFailed ? 'red' : 'green'}>{h?.webhooksFailed ? `${h.webhooksFailed} failed` : 'OK'}</StatusPill>, '—', '—', 'Failed webhook deliveries'],
        ]
      : tab === 'queues'
        ? (h?.queues ?? []).map((q) => [q.queue, 'Background jobs', <StatusPill key="s" tone={q.status === 'DEAD' || q.status === 'FAILED' ? 'red' : q.status === 'SUCCEEDED' ? 'green' : 'blue'}>{label(q.status)}</StatusPill>, String(q.count), '—', ''])
        : tab === 'dead'
          ? (h?.deadJobs ?? []).map((j) => [
              j.queue,
              `${j.attempts} attempts`,
              <StatusPill key="s" tone="red">
                Dead
              </StatusPill>,
              '—',
              dateTime(j.updatedAt),
              <span key="e" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <small style={{ color: 'var(--muted)', maxWidth: 320 }}>{j.lastError ?? '—'}</small>
                <ActionButton size="sm" variant="outline" icon={<RotateCw size={14} />} path={`/admin/jobs/${j.id}/retry`} body={{}}>
                  Retry
                </ActionButton>
              </span>,
            ])
          : (h?.incidents ?? []).map((i) => [
              i.title,
              i.publicSummary ?? '—',
              <StatusPill key="s" tone={i.status === 'RESOLVED' ? 'green' : 'amber'}>
                {label(i.status)}
              </StatusPill>,
              dateTime(i.startedAt),
              i.resolvedAt ? dateTime(i.resolvedAt) : '—',
              i.status !== 'RESOLVED' ? (
                <span key="a" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {INCIDENT.filter((x) => x !== i.status).map((x) => (
                    <ActionButton key={x} size="sm" variant={x === 'RESOLVED' ? 'primary' : 'ghost'} method="PATCH" path={`/admin/incidents/${i.id}`} body={{ status: x }}>
                      {label(x)}
                    </ActionButton>
                  ))}
                </span>
              ) : (
                ''
              ),
            ]);

  const columns =
    tab === 'incidents' ? ['Incident', 'Summary', 'Status', 'Started', 'Resolved', 'Actions'] : tab === 'dead' ? ['Queue', 'Attempts', 'Status', '', 'Failed', 'Error / Actions'] : tab === 'queues' ? ['Queue', 'Type', 'Status', 'Jobs', '', ''] : ['Service Name', 'Type', 'Status', 'Response Time', 'Last Checked', 'Notes'];

  return (
    <AdminList
      section="System Operations"
      title="System Health"
      description="Current status of the platform's database, background jobs, providers and incidents."
      about={{ title: 'About System Health', text: 'The database is checked live; other components are checked on a schedule. Provider rows show whether keys are configured and the last 24 hours of calls and errors.' }}
      metrics={[
        { label: 'Overall Status', icon: <CheckCircle2 size={24} />, tone: failing ? 'red' : 'green', value: h ? (failing ? `${failing} issue${failing === 1 ? '' : 's'}` : 'Healthy') : undefined },
        { label: 'Components Checked', icon: <Server size={24} />, tone: 'blue', value: h ? latest.length + 1 : undefined },
        { label: 'Open Incidents', icon: <AlertTriangle size={24} />, tone: 'amber', value: h ? openIncidents.length : undefined },
        { label: 'Dead Jobs', icon: <Clock3 size={24} />, tone: 'purple', value: h ? h.deadJobs.length : undefined },
      ]}
      tabs={[
        { key: 'services', label: 'Services' },
        { key: 'queues', label: 'Queues' },
        { key: 'dead', label: 'Dead Jobs' },
        { key: 'incidents', label: 'Incidents' },
      ]}
      activeTab={tab}
      basePath="/admin/health"
      search="Search..."
      columns={columns}
      rows={rows}
      empty={{ icon: <Server size={40} />, title: h ? (tab === 'incidents' ? 'No incidents' : tab === 'dead' ? 'No dead jobs' : 'Nothing to show') : 'Health data unavailable', text: h ? 'All clear.' : 'Your account cannot read system data, or the API is unavailable.' }}
      footnote={h ? `Checked ${dateTime(h.checkedAt)}.` : undefined}
    >
      {tab === 'incidents' && h && (
        <Panel title="Open an Incident" description="Tracks an outage or degradation; staff are alerted by email when alerts are on.">
          <ApiForm path="/admin/incidents" submitLabel="Open Incident" resetOnSuccess successMessage="Incident opened.">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(260px, 2fr)', gap: 12 }}>
              <Field label="Title" htmlFor="in-title">
                <Input id="in-title" name="title" required minLength={3} maxLength={200} placeholder="e.g. Audits delayed" />
              </Field>
              <Field label="Public summary (optional)" htmlFor="in-sum">
                <Textarea id="in-sum" name="publicSummary" data-type="optional" rows={1} maxLength={2000} />
              </Field>
            </div>
          </ApiForm>
        </Panel>
      )}
    </AdminList>
  );
}

