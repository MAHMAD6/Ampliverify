import { notFound } from 'next/navigation';
import { Badge, KeyValue, PageHeader, Panel } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate, humanize } from '@/lib/format';
import type { Project } from '@/lib/types';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await apiGet<Project>(`/user/projects/${encodeURIComponent((await params).id)}`, { auth: true });
  if (!result.ok) notFound();
  const project = result.data;
  return (
    <>
      <PageHeader
        title={project.name}
        description="Project overview."
        crumbs={[{ label: 'My Projects', href: '/app/projects' }, { label: project.name }]}
        actions={<Badge tone={project.status === 'ACTIVE' ? 'green' : undefined}>{humanize(project.status)}</Badge>}
      />
      <Panel title="Details">
        <KeyValue label="Status" value={humanize(project.status)} />
        <KeyValue label="Created" value={formatDate(project.createdAt)} />
        <KeyValue label="Last updated" value={formatDate(project.updatedAt)} />
      </Panel>
    </>
  );
}
