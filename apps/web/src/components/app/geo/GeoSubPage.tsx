import type { ReactNode } from 'react';
import { Button, ButtonLink, Card, DataTable, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { ProjectPicker } from '@/components/app/ProjectPicker';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import p from '@/components/app/pages.module.css';

/**
 * Standalone AI Search (GEO) page (navigation-batch1/04, decision 3: Overview,
 * Prompt Tracking, Competitors, Sources & Citations and History are separate
 * pages, not tabs). No screen designs were supplied for the four sub-pages, so
 * each shows the project selector and its table with an honest empty state.
 */
export async function GeoSubPage({
  title,
  description,
  tableTitle,
  columns,
  icon,
  emptyTitle,
  emptyText,
  action,
}: {
  title: string;
  description: string;
  tableTitle: string;
  columns: string[];
  icon: ReactNode;
  emptyTitle: string;
  emptyText: string;
  action?: string;
}) {
  const { projects, selectedProject } = await getAppContext();
  return (
    <>
      <PageHeader title={title} description={description} crumbs={appCrumbs({ label: 'AI Search (GEO)', href: '/app/geo' }, { label: title })} />
      <Card style={{ marginBottom: 16 }}>
        <div className={p.projectBar}>
          <div>
            <h2>Project</h2>
            <p>AI search data is tracked per project.</p>
          </div>
          <ProjectPicker projects={projects} selectedId={selectedProject?.id} className={p.projectBarSelect} />
          {selectedProject && (
            <div className={p.projectBarActions}>
              <ButtonLink href={`/app/projects/${selectedProject.id}`} variant="secondary">
                Manage Project
              </ButtonLink>
            </div>
          )}
        </div>
      </Card>
      <Panel title={tableTitle} bodyless actions={action ? <Button disabled>{action}</Button> : undefined}>
        <DataTable
          columns={columns}
          empty={
            selectedProject ? (
              <StateView kind="empty" compact icon={icon} title={emptyTitle} description={emptyText} />
            ) : (
              <StateView kind="empty" compact icon={icon} title="Select a project" description="Choose a project above to see its AI search data." />
            )
          }
        />
      </Panel>
    </>
  );
}
