import { Activity as ActivityIcon } from 'lucide-react';
import { DataTable, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Connection Activity · Integrations' };

type Connection = { id: string; status: string; account: string | null; connectedBy: string; createdAt: string; lastSync: { status: string; at: string; error: string | null } | null; projects: { id: string; name: string; sourceType: string; config: { propertyId?: string; siteUrl?: string } | null; lastSyncAt: string | null }[] };
type ProviderRow = { key: string; name: string; authType: string; available: boolean; connections: Connection[] };
type Activity = { syncs: { id: string; provider: string; account: string | null; syncType: string; status: string; rows: number | null; dataThrough: string | null; startedAt: string; completedAt: string | null; error: string | null }[]; events: { id: string; action: string; at: string }[] };

const EVENT: Record<string, string> = {
  'workspace.integration.connect': 'Account connected',
  'workspace.integration.disconnect': 'Account disconnected',
};

export default async function ConnectionActivityPage() {
  const { workspaceId } = await getAppContext();
  const res = workspaceId ? await apiGet<Activity>(`/user/workspaces/${workspaceId}/integrations/activity`, { auth: true }) : null;
  return (
    <>
      <PageHeader title="Connection Activity" description="Syncs and connection changes in this workspace." crumbs={appCrumbs({ label: 'Integrations', href: '/app/integrations' }, { label: 'Connection Activity' })} />
      {!res?.ok ? (
        <Panel>
          <StateView kind="error" title="Activity could not be loaded" description="Please try again shortly." />
        </Panel>
      ) : res.data.syncs.length === 0 && res.data.events.length === 0 ? (
        <Panel>
          <StateView kind="empty" icon={<ActivityIcon size={36} />} title="No activity yet" description="Connection changes and data syncs will appear here." />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Syncs" bodyless>
            <DataTable
              columns={['Integration', 'Account', 'Sync', 'Status', 'Rows', 'Data through', 'Started', 'Finished', 'Error']}
              rows={res.data.syncs.map((s) => [s.provider, s.account ?? '—', humanize(s.syncType), humanize(s.status), s.rows ?? '—', formatDateTime(s.dataThrough), formatDateTime(s.startedAt), formatDateTime(s.completedAt), s.error ?? '—'])}
              empty="No syncs yet."
            />
          </Panel>
          <Panel title="Connection changes" bodyless>
            <DataTable columns={['Event', 'When']} rows={res.data.events.map((e) => [EVENT[e.action] ?? humanize(e.action.replace('workspace.integration.', '')), formatDateTime(e.at)])} empty="No connection changes yet." />
          </Panel>
        </div>
      )}
    </>
  );
}
