import { Share2 } from 'lucide-react';
import { PageHeader, Panel } from '@/components/ui';
import { ReportsTabs } from '@/components/app/reports/ReportsTabs';
import { ReportsTable } from '@/components/app/reports/ReportsTable';
import { appCrumbs } from '@/lib/nav';
import { apiGet } from '@/lib/api';
import type { ReportRow } from '@/lib/app-types';

export const metadata = { title: 'Shared Reports' };

/** Reports with an active share link; open one to copy a new link or revoke access. */
export default async function SharedReportsPage() {
  const res = await apiGet<ReportRow[]>('/user/reports/shared', { auth: true });
  return (
    <>
      <PageHeader title="Shared Reports" description="Reports you have shared and their access links." crumbs={appCrumbs({ label: 'Reports', href: '/app/reports' }, { label: 'Shared' })} />
      <ReportsTabs active="shared" />
      <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Share2 size={18} /> Shared reports</span>} bodyless>
        <ReportsTable reports={res.ok ? res.data : []} emptyText="Open a report and create a share link to see it here." />
      </Panel>
    </>
  );
}
