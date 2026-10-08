import { notFound } from 'next/navigation';
import { SeoEditor, type EditorDoc } from '@/components/app/editor/SeoEditor';
import type { WpConnection } from '@/components/app/cms/ConnectWebsite';
import { apiGet } from '@/lib/api';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'On-Page SEO Editor' };

type ProviderRow = { key: string; connections: WpConnection[] };

export default async function EditorDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiGet<EditorDoc>(`/user/editor/documents/${encodeURIComponent(id)}`, { auth: true });
  if (!res.ok) notFound();
  const { projects } = await getAppContext();
  const project = projects.find((p) => p.id === res.data.projectId) ?? null;
  const integrations = project ? await apiGet<ProviderRow[]>(`/user/workspaces/${project.workspaceId}/integrations`, { auth: true }) : null;
  const wp = integrations?.ok ? (integrations.data.find((p) => p.key === 'wordpress')?.connections ?? []) : [];
  return (
    <SeoEditor
      key={res.data.id}
      doc={res.data}
      projectName={project?.name ?? null}
      connections={wp.filter((c) => c.status === 'ACTIVE').map((c) => ({ id: c.id, label: c.account ?? 'WordPress site' }))}
    />
  );
}
