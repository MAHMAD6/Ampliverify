import { BookOpen } from 'lucide-react';
import { ConnectWebsite, type Platform, type WpConnection } from '@/components/app/cms/ConnectWebsite';
import { ButtonLink, PageHeader } from '@/components/ui';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';

export const metadata = { title: 'Connect Your Website' };

type ProviderRow = { key: string; available: boolean; connections: WpConnection[] };

export default async function CmsConnectionPage() {
  const { workspaceId, selectedProject } = await getAppContext();
  const res = workspaceId ? await apiGet<ProviderRow[]>(`/user/workspaces/${workspaceId}/integrations`, { auth: true }) : null;
  const rows = res?.ok ? res.data : [];
  const connections: Partial<Record<Platform, WpConnection | null>> = Object.fromEntries((['wordpress', 'webflow', 'shopify', 'custom_webhook'] as Platform[]).map((k) => [k, rows.find((p) => p.key === k)?.connections[0] ?? null]));
  const available = rows.some((p) => p.key === 'wordpress' && p.available);
  return (
    <>
      <PageHeader
        title="Connect Your Website"
        description="Connect your website or CMS to publish optimized content directly from AmpliVerify."
        crumbs={appCrumbs({ label: 'Settings', href: '/app/settings/account' }, { label: 'Integrations', href: '/app/settings/integrations' }, { label: 'CMS Connection' })}
        actions={
          <ButtonLink href="/help?q=connect%20website" variant="outline" icon={<BookOpen size={18} />}>
            View Help Guide
          </ButtonLink>
        }
      />
      <ConnectWebsite workspaceId={workspaceId} projectId={selectedProject?.id ?? null} connections={connections} available={available} />
    </>
  );
}
