import { ButtonLink, Notice, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { appCrumbs } from '@/lib/nav';
import { apiGet } from '@/lib/api';
import { ProjectForm } from './ProjectForm';

export const metadata = { title: 'Add Project' };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const workspaces = await apiGet<{ id: string; name: string }[]>('/user/workspaces', { auth: true });
  const list = workspaces.ok ? workspaces.data : [];
  return (
    <>
      <PageHeader
        title="Add Project"
        description="Create a project for a website you want to audit, optimize and monitor."
        crumbs={appCrumbs({ label: 'My Projects', href: '/app/projects' }, { label: 'Add Project' })}
      />
      <div style={{ maxWidth: 640 }}>
        {created ? (
          <Panel>
            <StateView
              kind="success"
              compact
              title="Project created successfully"
              description="Your project is ready. Add domains and pages, then run your first audit."
              action={<ButtonLink href={`/app/projects/${encodeURIComponent(created)}`}>View Project</ButtonLink>}
              secondary={
                <ButtonLink href="/app/projects/new" variant="outline">
                  Add Another
                </ButtonLink>
              }
            />
          </Panel>
        ) : (
        <Panel title="Project details" description="You can add domains and pages after the project is created.">
          {workspaces.ok && list.length === 0 && (
            <div style={{ marginBottom: 16 }}>
              <Notice tone="amber">You need a workspace before you can add a project.</Notice>
            </div>
          )}
          <ProjectForm workspaces={list} disabled={!workspaces.ok || list.length === 0} />
        </Panel>
        )}
      </div>
    </>
  );
}
