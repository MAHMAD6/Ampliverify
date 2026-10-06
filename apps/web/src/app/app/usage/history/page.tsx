import { History } from 'lucide-react';
import { DataTable, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { UsageHeader } from '@/components/app/usage/UsageHeader';
import { appCrumbs } from '@/lib/nav';

export const metadata = { title: 'Credit History · Usage & Credits' };

/** Credit ledger entries (`credit_ledger`: grants, purchases, usage, adjustments). The ledger API is not exposed yet. */
export default function CreditHistoryPage() {
  return (
    <>
      <UsageHeader active="history" crumbs={appCrumbs({ label: 'Usage & Credits', href: '/app/usage' }, { label: 'Credit History' })} />
      <Panel title="Credit Activity" bodyless>
        <DataTable
          columns={['Date & Time', 'Type', 'Description', 'Project', 'Credits', 'Balance After']}
          empty={<StateView kind="empty" compact icon={<History size={28} />} title="No credit activity yet" description="Credit grants, purchases, usage and adjustments will appear here." />}
        />
      </Panel>
    </>
  );
}
