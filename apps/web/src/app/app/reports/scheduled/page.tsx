import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Badge, DataTable, Field, Input, PageHeader, Panel, Select } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { ReportsTabs } from '@/components/app/reports/ReportsTabs';
import { REPORT_TYPES } from '@/components/app/reports/meta';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';

export const metadata = { title: 'Scheduled Reports' };

type Schedule = {
  id: string;
  name: string;
  reportType: string;
  cadence: 'WEEKLY' | 'MONTHLY';
  nextRunAt: string;
  enabled: boolean;
  project: { id: string; name: string };
  reports: { id: string; status: string; createdAt: string }[];
};

/** Recurring report generation (`report_schedules`); owners are notified when each report is ready. */
export default async function ScheduledReportsPage() {
  const { projects, selectedProject } = await getAppContext();
  const res = await apiGet<Schedule[]>('/user/report-schedules', { auth: true });
  const schedules = res.ok ? res.data : [];
  const target = selectedProject ?? projects[0];
  return (
    <>
      <PageHeader title="Scheduled Reports" description="Reports generated automatically on a schedule." crumbs={appCrumbs({ label: 'Reports', href: '/app/reports' }, { label: 'Scheduled' })} />
      <ReportsTabs active="scheduled" />
      {target && (
        <Panel title="New schedule" description={`Creates a recurring report for ${target.name}. Switch project in the top bar to schedule another.`} flushHead>
          <ApiForm path={`/user/projects/${target.id}/report-schedules`} submitLabel="Create schedule" resetOnSuccess successMessage="Schedule created.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="Name" htmlFor="s-name">
                <Input id="s-name" name="name" required maxLength={160} placeholder="Monthly client report" />
              </Field>
              <Field label="Report type" htmlFor="s-type">
                <Select id="s-type" name="reportType" defaultValue="EXECUTIVE_SUMMARY">
                  {REPORT_TYPES.filter(([v]) => v !== 'CUSTOM').map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Frequency" htmlFor="s-cadence">
                <Select id="s-cadence" name="cadence" defaultValue="MONTHLY">
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </Select>
              </Field>
            </div>
          </ApiForm>
        </Panel>
      )}
      <div style={{ height: 16 }} />
      <Panel title="Schedules" bodyless>
        <DataTable
          columns={['Schedule', 'Project', 'Type', 'Frequency', 'Next Run', 'Last Report', 'Status', 'Actions']}
          rows={schedules.map((s) => [
            <b key="n">{s.name}</b>,
            s.project.name,
            REPORT_TYPES.find(([v]) => v === s.reportType)?.[1] ?? s.reportType,
            s.cadence === 'WEEKLY' ? 'Weekly' : 'Monthly',
            s.enabled ? formatDateTime(s.nextRunAt) : '—',
            s.reports[0] ? (
              <Link key="l" href={`/app/reports/${s.reports[0].id}`} style={{ color: 'var(--blue)' }}>
                {formatDate(s.reports[0].createdAt)}
              </Link>
            ) : (
              '—'
            ),
            <Badge key="b" tone={s.enabled ? 'green' : undefined}>
              {s.enabled ? 'Active' : 'Paused'}
            </Badge>,
            <div key="a" style={{ display: 'flex', gap: 6 }}>
              <ActionButton size="sm" variant="ghost" method="PATCH" path={`/user/report-schedules/${s.id}`} body={{ enabled: !s.enabled }}>
                {s.enabled ? 'Pause' : 'Resume'}
              </ActionButton>
              <ActionButton size="sm" variant="ghost" method="DELETE" path={`/user/report-schedules/${s.id}`} confirm="Delete this schedule? Existing reports are kept.">
                Delete
              </ActionButton>
            </div>,
          ])}
          empty={<StateView kind="empty" compact icon={<CalendarClock size={28} />} title="No scheduled reports" description="Create a schedule above to generate reports automatically." />}
        />
      </Panel>
    </>
  );
}
