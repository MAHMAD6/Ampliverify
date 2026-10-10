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
  // Every connected CMS can receive this document.
  const CMS: Record<string, string> = { wordpress: 'WordPress', webflow: 'Webflow', shopify: 'Shopify', custom_webhook: 'Custom (API)' };
  const cms = integrations?.ok ? integrations.data.filter((p) => p.key in CMS).flatMap((p) => p.connections.filter((c) => c.status === 'CONNECTED').map((c) => ({ id: c.id, label: `${CMS[p.key]} · ${c.account ?? ''}`, provider: p.key }))) : [];
  return (
    <SeoEditor
      key={res.data.id}
      doc={res.data}
      projectName={project?.name ?? null}
      connections={cms}
    />
  );
}
