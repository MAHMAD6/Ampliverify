import Link from 'next/link';
import { Activity as ActivityIcon, AlertTriangle, Database, Link2, Plug } from 'lucide-react';
import { Badge, ButtonLink, DataTable, Grid, Metric, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Integrations Dashboard' };

type Connection = { id: string; status: string; account: string | null; connectedBy: string; createdAt: string; lastSync: { status: string; at: string; error: string | null } | null; projects: { id: string; name: string; sourceType: string; config: { propertyId?: string; siteUrl?: string } | null; lastSyncAt: string | null }[] };
type ProviderRow = { key: string; name: string; authType: string; available: boolean; connections: Connection[] };
type Activity = { syncs: { id: string; provider: string; account: string | null; syncType: string; status: string; rows: number | null; dataThrough: string | null; startedAt: string; completedAt: string | null; error: string | null }[]; events: { id: string; action: string; at: string }[] };

/** Integrations Dashboard (V2 guide §2.1): live connection and sync status for the workspace. */
export default async function IntegrationsDashboard() {
  const { workspaceId } = await getAppContext();
  const [list, activity] = workspaceId ? await Promise.all([apiGet<ProviderRow[]>(`/user/workspaces/${workspaceId}/integrations`, { auth: true }), apiGet<Activity>(`/user/workspaces/${workspaceId}/integrations/activity`, { auth: true })]) : [null, null];
  const providers = list?.ok ? list.data : [];
  const connections = providers.flatMap((p) => p.connections.map((c) => ({ ...c, provider: p.name })));
  const syncs = activity?.ok ? activity.data.syncs : [];
  const failures = syncs.filter((s) => s.status === 'FAILED').length;
  const needsAttention = connections.filter((c) => c.status !== 'CONNECTED');
  return (
    <>
      <PageHeader title="Integrations Dashboard" description="Connected accounts, data flowing into your projects and recent sync activity." crumbs={appCrumbs({ label: 'Integrations' })} actions={<ButtonLink href="/app/integrations/accounts">Connect an account</ButtonLink>} />
      {!list?.ok ? (
        <Panel>
          <StateView kind="error" title="Integrations could not be loaded" description="Please try again shortly." />
        </Panel>
      ) : (
        <>
          <Grid cols={4}>
            <Metric label="Connected accounts" value={connections.length} note={`${providers.filter((p) => p.available).length} integrations available`} icon={<Link2 size={22} />} tone="blue" />
            <Metric label="Data connections" value={connections.reduce((t, c) => t + c.projects.length, 0)} note="Project data sources" icon={<Database size={22} />} tone="green" />
            <Metric label="Recent syncs" value={syncs.length} note={syncs[0] ? `Last ${formatDateTime(syncs[0].startedAt)}` : 'No syncs yet'} icon={<ActivityIcon size={22} />} tone="purple" />
            <Metric label="Need attention" value={needsAttention.length + failures} note={`${failures} failed sync${failures === 1 ? '' : 's'}`} icon={<AlertTriangle size={22} />} tone={needsAttention.length + failures ? 'red' : 'slate'} />
          </Grid>
          <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            <Panel title="Connected accounts" actions={<Link href="/app/integrations/accounts">Manage</Link>} bodyless={connections.length > 0}>
              {connections.length ? (
                <DataTable
                  columns={['Integration', 'Account', 'Status', 'Projects', 'Last sync']}
                  rows={connections.map((c) => [c.provider, c.account ?? '—', <Badge key="s" tone={c.status === 'CONNECTED' ? 'green' : 'amber'}>{humanize(c.status)}</Badge>, c.projects.length, c.lastSync ? `${humanize(c.lastSync.status)} · ${formatDateTime(c.lastSync.at)}` : '—'])}
                />
              ) : (
                <StateView kind="empty" icon={<Plug size={34} />} title="No accounts connected" description="Connect Google Search Console, Google Analytics or your CMS to bring real data into your projects." action={<ButtonLink href="/app/integrations/accounts" size="sm">Connect an account</ButtonLink>} />
              )}
            </Panel>
            <Panel title="Recent activity" actions={<Link href="/app/integrations/activity">View all</Link>} bodyless={syncs.length > 0}>
              {syncs.length ? (
                <DataTable columns={['Integration', 'Sync', 'Status', 'Rows', 'Started']} rows={syncs.slice(0, 8).map((s) => [s.provider, humanize(s.syncType), humanize(s.status), s.rows ?? '—', formatDateTime(s.startedAt)])} />
              ) : (
                <StateView kind="empty" icon={<ActivityIcon size={34} />} title="No sync activity yet" description="Syncs appear here once a connected account is linked to a project." />
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
