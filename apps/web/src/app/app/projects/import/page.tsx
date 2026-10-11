import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ButtonLink, Notice, PageHeader, Panel } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Import from Google Search Console' };

type Connection = { id: string; status: string; account: string | null };
type ProviderRow = { key: string; available: boolean; connections: Connection[] };

/** Creates projects from the sites on a connected Google Search Console account. */
export default async function ImportProjectsPage() {
  const { workspaceId } = await getAppContext();
  const list = workspaceId ? await apiGet<ProviderRow[]>(`/user/workspaces/${workspaceId}/integrations`, { auth: true }) : null;
  const gsc = list?.ok ? list.data.find((p) => p.key === 'google_search_console') : undefined;
  const connection = gsc?.connections.find((c) => c.status === 'CONNECTED');
  const sites = connection ? await apiGet<{ id: string; name: string; permission?: string }[]>(`/user/integrations/${connection.id}/properties`, { auth: true }) : null;

  return (
    <>
      <Link href="/app/projects" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--blue)', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
        <ArrowLeft size={16} /> Back to Projects
      </Link>
      <PageHeader title="Import from Google Search Console" description="Create a project for each site you choose. Each new project is linked to its Search Console property, so search performance data is available right away." />
      <Panel>
        {!workspaceId ? (
          <Notice tone="amber">You need a workspace before you can import projects.</Notice>
        ) : !gsc?.available ? (
          <Notice tone="amber">Google Search Console is not configured on this server yet. Add projects manually instead.</Notice>
        ) : !connection ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0 }}>Connect your Google Search Console account first, then come back to choose the sites to import.</p>
            <div>
              <ButtonLink href="/app/settings/integrations">Connect Google Search Console</ButtonLink>
            </div>
          </div>
        ) : !sites?.ok ? (
          <Notice tone="amber">Could not load your Search Console sites. Try reconnecting Google Search Console in Settings → Integrations.</Notice>
        ) : sites.data.length === 0 ? (
          <Notice tone="amber">The connected Google account ({connection.account ?? 'Search Console'}) has no sites. Add your site in Search Console, or add a project manually.</Notice>
        ) : (
          <ApiForm path={`/user/workspaces/${workspaceId}/integrations/google/import-projects`} extra={{ integrationId: connection.id }} submitLabel="Import selected sites" successMessage="Projects imported." revalidate={['/app/projects']} redirectTo="/app/projects">
            <p style={{ margin: '0 0 10px' }}>
              Sites on <strong>{connection.account ?? 'your Google account'}</strong>. Sites whose domain already has a project are linked to that project instead of creating a duplicate. Project limits of your plan apply.
            </p>
            <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', display: 'grid', gap: 8 }}>
              <legend style={{ fontSize: 14, fontWeight: 600 }}>Sites</legend>
              {sites.data.slice(0, 25).map((site) => (
                <label key={site.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                  <input type="checkbox" name="siteUrls" data-type="array" value={site.id} />
                  <span>{site.name.replace(/^sc-domain:/, '')}</span>
                  {site.id.startsWith('sc-domain:') && <span style={{ color: 'var(--muted)', fontSize: 12 }}>Domain property</span>}
                </label>
              ))}
            </fieldset>
            {sites.data.length > 25 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Showing the first 25 sites. Import these, then return to import more.</p>}
          </ApiForm>
        )}
      </Panel>
    </>
  );
}
