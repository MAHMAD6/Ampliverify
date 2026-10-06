import { CalendarClock } from 'lucide-react';
import { Button, DataTable, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { ReportsTabs } from '@/components/app/reports/ReportsTabs';
import { appCrumbs } from '@/lib/nav';

export const metadata = { title: 'Scheduled Reports' };

/** Recurring report deliveries (`report_schedules`). The schedules API is not built yet. */
export default function ScheduledReportsPage() {
  return (
    <>
      <PageHeader title="Scheduled Reports" description="Reports generated and delivered automatically on a schedule." crumbs={appCrumbs({ label: 'Reports', href: '/app/reports' }, { label: 'Scheduled' })} />
      <ReportsTabs active="scheduled" />
      <Panel title="Schedules" bodyless actions={<Button disabled>New Schedule</Button>}>
        <DataTable
          columns={['Report', 'Project', 'Frequency', 'Recipients', 'Next Run', 'Status', 'Actions']}
          empty={<StateView kind="empty" compact icon={<CalendarClock size={28} />} title="No scheduled reports" description="Scheduled reports will appear here once scheduling is available for your plan." />}
        />
      </Panel>
    </>
  );
}
