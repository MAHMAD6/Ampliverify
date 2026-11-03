import { Notice, PageHeader } from '@/components/ui';
import { SellForm } from '@/components/app/marketplace/SellForm';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Sell a Digital Asset · Marketplace' };

export default async function SellPage() {
  const ctx = await getAppContext();
  return (
    <>
      <PageHeader title="Sell a Digital Asset" description="Describe what you are selling. Our team reviews every listing before it is visible to buyers." />
      {ctx.workspaceId ? <SellForm workspaceId={ctx.workspaceId} /> : <Notice tone="neutral">Create a workspace first; listings belong to a workspace.</Notice>}
    </>
  );
}
