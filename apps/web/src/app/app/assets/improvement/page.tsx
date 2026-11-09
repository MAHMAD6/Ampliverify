import Link from 'next/link';
import { ButtonLink, DataTable, PageHeader, Panel } from '@/components/ui';
import { AssetsError, assetLink, NoAssets, NoWorkspace } from '@/components/app/assets/parts';
import { apiGet } from '@/lib/api';
import type { AssetPerformance } from '@/lib/assets';
import { humanize } from '@/lib/format';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Improvement Workspace · Digital Assets' };

/** Where each asset stands on SEO improvement work, from the tasks of its linked project. */
export default async function ImprovementPage() {
  const { workspaceId } = await getAppContext();
  if (!workspaceId) return <NoWorkspace />;
  const res = await apiGet<AssetPerformance[]>(`/user/assets/performance?workspaceId=${workspaceId}`, { auth: true });
  if (!res.ok) return <AssetsError />;
  const linked = res.data.filter((a) => a.project);
  const unlinked = res.data.filter((a) => !a.project);
  const count = (t: Record<string, number>, ...k: string[]) => k.reduce((s, x) => s + (t[x] ?? 0), 0);
  return (
    <>
      <PageHeader title="Improvement Workspace" description="Turn audits into a plan for each asset. Tasks come from the asset's linked project." crumbs={appCrumbs({ label: 'Digital Assets', href: '/app/assets' }, { label: 'Improvement Workspace' })} />
      {res.data.length === 0 ? (
        <NoAssets />
      ) : (
        <div className={m.stack}>
          <Panel title="Assets with improvement plans" bodyless>
            <DataTable
              columns={['Asset', 'Project', 'Open', 'In progress', 'Done', '']}
              rows={linked.map((a) => [
                assetLink(a),
                a.project ? <Link key="p" href={`/app/projects/${a.project.id}`}>{a.project.name}</Link> : '—',
                count(a.tasks, 'OPEN', 'TODO'),
                count(a.tasks, 'IN_PROGRESS'),
                count(a.tasks, 'DONE', 'COMPLETED', 'RESOLVED'),
                <ButtonLink key="o" href="/app/optimize" size="sm" variant="outline">
                  Open tasks
                </ButtonLink>,
              ])}
              empty="No assets are linked to a project yet."
            />
          </Panel>
          {unlinked.length > 0 && (
            <Panel title="Not linked to a project" description="Link a project to run audits and track tasks for these assets.">
              <ul className={m.list}>
                {unlinked.map((a) => (
                  <li key={a.id}>
                    {assetLink(a)} · {a.domain ?? 'no website address'} · <Link href={`/app/assets/${a.id}`}>Link a project</Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <p className={m.muted}>Task statuses: {Object.keys(Object.assign({}, ...res.data.map((a) => a.tasks))).map(humanize).join(', ') || 'none yet'}.</p>
        </div>
      )}
    </>
  );
}
