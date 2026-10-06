import { Share2 } from 'lucide-react';
import { DataTable, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { ReportsTabs } from '@/components/app/reports/ReportsTabs';
import { appCrumbs } from '@/lib/nav';

export const metadata = { title: 'Shared Reports' };

/** Reports shared by link or with people (`report_shares`). */
export default function SharedReportsPage() {
  return (
    <>
      <PageHeader title="Shared Reports" description="Reports you have shared and their access links." crumbs={appCrumbs({ label: 'Reports', href: '/app/reports' }, { label: 'Shared' })} />
      <ReportsTabs active="shared" />
      <Panel title="Shared Links" bodyless>
        <DataTable
          columns={['Report', 'Shared With', 'Access', 'Expires', 'Views', 'Actions']}
          empty={<StateView kind="empty" compact icon={<Share2 size={28} />} title="No shared reports" description="Reports you share will be listed here so you can review or revoke access." />}
        />
      </Panel>
    </>
  );
}
