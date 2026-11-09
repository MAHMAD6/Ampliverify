import Link from 'next/link';
import { Database } from 'lucide-react';
import { ButtonLink, DataTable, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Data Connections · Integrations' };

type Connection = { id: string; status: string; account: string | null; connectedBy: string; createdAt: string; lastSync: { status: string; at: string; error: string | null } | null; projects: { id: string; name: string; sourceType: string; config: { propertyId?: string; siteUrl?: string } | null; lastSyncAt: string | null }[] };
type ProviderRow = { key: string; name: string; authType: string; available: boolean; connections: Connection[] };
type Activity = { syncs: { id: string; provider: string; account: string | null; syncType: string; status: string; rows: number | null; dataThrough: string | null; startedAt: string; completedAt: string | null; error: string | null }[]; events: { id: string; action: string; at: string }[] };

/** Which connected account feeds which project, and when data last arrived. */
export default async function DataConnectionsPage() {
  const { workspaceId } = await getAppContext();
  const res = workspaceId ? await apiGet<ProviderRow[]>(`/user/workspaces/${workspaceId}/integrations`, { auth: true }) : null;
  const rows = res?.ok ? res.data.flatMap((p) => p.connections.flatMap((c) => c.projects.map((pr) => ({ provider: p.name, account: c.account, status: c.status, ...pr })))) : [];
  return (
    <>
      <PageHeader title="Data Connections" description="Projects and the data sources linked to them." crumbs={appCrumbs({ label: 'Integrations', href: '/app/integrations' }, { label: 'Data Connections' })} />
      {!res?.ok ? (
        <Panel>
          <StateView kind="error" title="Data connections could not be loaded" description="Please try again shortly." />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <StateView kind="empty" icon={<Database size={36} />} title="No data connections yet" description="Connect an account, then choose the property each project should use." action={<ButtonLink href="/app/integrations/accounts">Connected Accounts</ButtonLink>} />
        </Panel>
      ) : (
        <Panel bodyless>
          <DataTable
            columns={['Project', 'Source', 'Account', 'Property', 'Connection', 'Last data']}
            rows={rows.map((r) => [
              <Link key="p" href={`/app/projects/${r.id}`}>
                {r.name}
              </Link>,
              r.provider,
              r.account ?? '—',
              r.config?.propertyId ?? r.config?.siteUrl ?? '—',
              humanize(r.status),
              formatDateTime(r.lastSyncAt),
            ])}
          />
        </Panel>
      )}
    </>
  );
}
