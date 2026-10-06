import { Notice, PageHeader, Panel } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { ProjectForm } from './ProjectForm';

export const metadata = { title: 'Add Project' };

export default async function NewProjectPage() {
  const workspaces = await apiGet<{ id: string; name: string }[]>('/user/workspaces', { auth: true });
  const list = workspaces.ok ? workspaces.data : [];
  return (
    <>
      <PageHeader
        title="Add Project"
        description="Create a project for a website you want to audit, optimize and monitor."
        crumbs={[{ label: 'My Projects', href: '/app/projects' }, { label: 'Add Project' }]}
      />
      <div style={{ maxWidth: 640 }}>
        <Panel title="Project details" description="You can add domains and pages after the project is created.">
          {workspaces.ok && list.length === 0 && (
            <div style={{ marginBottom: 16 }}>
              <Notice tone="amber">You need a workspace before you can add a project.</Notice>
            </div>
          )}
          <ProjectForm workspaces={list} disabled={!workspaces.ok || list.length === 0} />
        </Panel>
      </div>
    </>
  );
}
