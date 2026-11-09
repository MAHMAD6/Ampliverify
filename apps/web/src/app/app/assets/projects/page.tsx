import Link from 'next/link';
import { FolderKanban } from 'lucide-react';
import { ButtonLink, DataTable, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { AssetsError, assetLink, NoWorkspace } from '@/components/app/assets/parts';
import { apiGet } from '@/lib/api';
import type { Asset } from '@/lib/assets';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Digital Asset Projects' };

/** Projects linked to digital assets: the SEO workspace behind each asset. */
export default async function AssetProjectsPage() {
  const { workspaceId, projects } = await getAppContext();
  if (!workspaceId) return <NoWorkspace />;
  const res = await apiGet<Asset[]>(`/user/assets?workspaceId=${workspaceId}`, { auth: true });
  if (!res.ok) return <AssetsError />;
  const byProject = new Map<string, Asset[]>();
  for (const a of res.data) if (a.project) byProject.set(a.project.id, [...(byProject.get(a.project.id) ?? []), a]);
  const rows = projects.filter((p) => byProject.has(p.id));
  return (
    <>
      <PageHeader title="Digital Asset Projects" description="Each asset can be linked to a project for audits, content work and tracking." crumbs={appCrumbs({ label: 'Digital Assets', href: '/app/assets' }, { label: 'Digital Asset Projects' })} actions={<ButtonLink href="/app/projects/new">Create project</ButtonLink>} />
      {rows.length === 0 ? (
        <Panel>
          <StateView kind="empty" icon={<FolderKanban size={36} />} title="No asset projects yet" description="Link a project from an asset's page, or create a project for a website you own." action={<ButtonLink href="/app/assets/portfolio">Open portfolio</ButtonLink>} />
        </Panel>
      ) : (
        <Panel bodyless>
          <DataTable
            columns={['Project', 'Status', 'Domain', 'Assets']}
            rows={rows.map((p) => [
              <Link key="p" href={`/app/projects/${p.id}`}>
                {p.name}
              </Link>,
              p.status.charAt(0) + p.status.slice(1).toLowerCase(),
              p.primaryDomain ?? '—',
              <span key="a">
                {(byProject.get(p.id) ?? []).map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ', '}
                    {assetLink(a)}
                  </span>
                ))}
              </span>,
            ])}
          />
        </Panel>
      )}
    </>
  );
}
