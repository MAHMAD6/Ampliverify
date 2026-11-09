import { PageHeader, Panel } from '@/components/ui';
import { AssetForm } from '@/components/app/assets/AssetForm';
import { NoWorkspace } from '@/components/app/assets/parts';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Add Digital Asset' };

export default async function NewAssetPage() {
  const { workspaceId, projects } = await getAppContext();
  if (!workspaceId) return <NoWorkspace />;
  return (
    <>
      <PageHeader title="Add Digital Asset" description="Add a website or online business. You can verify ownership with a DNS record, meta tag or file once it is added." crumbs={appCrumbs({ label: 'Digital Assets', href: '/app/assets' }, { label: 'Add Digital Asset' })} />
      <Panel>
        <AssetForm workspaceId={workspaceId} projects={projects} />
      </Panel>
    </>
  );
}
