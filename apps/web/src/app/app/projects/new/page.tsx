import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ButtonLink, Notice, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { AddProjectWizard } from '@/components/app/projects/AddProjectWizard';
import { apiGet, apiList } from '@/lib/api';
import type { IntegrationProvider } from '@/lib/types';

export const metadata = { title: 'Add Project' };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const [workspaces, integrations] = await Promise.all([
    apiGet<{ id: string; name: string }[]>('/user/workspaces', { auth: true }),
    apiList<IntegrationProvider>('/public/integrations'),
  ]);
  const list = workspaces.ok ? workspaces.data : [];
  return (
    <>
      <Link href="/app/projects" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--blue)', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
        <ArrowLeft size={16} /> Back to Projects
      </Link>
      <PageHeader title="Add Project" description="Set up a new website or domain to run audits, create content strategies, and track your visibility." />
      {created ? (
        <Panel>
          <StateView
            kind="success"
            title="Project created successfully"
            description="Your project and domain are ready. Run your first audit when it is available for your workspace."
            action={<ButtonLink href={`/app/projects/${encodeURIComponent(created)}`}>View Project</ButtonLink>}
            secondary={
              <ButtonLink href="/app/projects/new" variant="outline">
                Add Another
              </ButtonLink>
            }
          />
        </Panel>
      ) : (
        <>
          {workspaces.ok && list.length === 0 && (
            <div style={{ marginBottom: 16 }}>
              <Notice tone="amber">You need a workspace before you can add a project.</Notice>
            </div>
          )}
          <AddProjectWizard workspaces={list} integrations={integrations.map((i) => ({ key: i.key, name: i.name }))} disabled={!workspaces.ok || list.length === 0} />
        </>
      )}
    </>
  );
}
