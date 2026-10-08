import { BookOpen } from 'lucide-react';
import { ConnectWebsite, type WpConnection } from '@/components/app/cms/ConnectWebsite';
import { ButtonLink, PageHeader } from '@/components/ui';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';

export const metadata = { title: 'Connect Your Website' };

type ProviderRow = { key: string; available: boolean; connections: WpConnection[] };

export default async function CmsConnectionPage() {
  const { workspaceId, selectedProject } = await getAppContext();
  const res = workspaceId ? await apiGet<ProviderRow[]>(`/user/workspaces/${workspaceId}/integrations`, { auth: true }) : null;
  const wp = res?.ok ? res.data.find((p) => p.key === 'wordpress') : undefined;
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
      <ConnectWebsite workspaceId={workspaceId} projectId={selectedProject?.id ?? null} connection={wp?.connections[0] ?? null} available={!!wp?.available} />
    </>
  );
}
