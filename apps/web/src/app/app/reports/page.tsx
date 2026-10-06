import { CalendarDays, FileSearch, PlusCircle, Search } from 'lucide-react';
import { REPORT_STATUSES, REPORT_TYPES } from '@/components/app/reports/meta';
import { ButtonLink, DataTable, EmptyState, Field, Input, PageHeader, Panel, Select } from '@/components/ui';
import { ReportsTabs } from '@/components/app/reports/ReportsTabs';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Report History' };

/**
 * All generated reports across the user's projects. The reports API is not
 * built yet, so the table is always empty; filters are real controls over
 * the (future) result set.
 */
export default async function ReportHistoryPage() {
  const { projects, selectedProject } = await getAppContext();
  const generateHref = selectedProject ? `/app/projects/${selectedProject.id}/reports` : '/app/projects';
  return (
    <>
      <PageHeader title="Report History" description="View, download, share, and manage all generated reports." crumbs={appCrumbs({ label: 'Reports', href: '/app/reports' }, { label: 'Report History' })} />
      <ReportsTabs active="all" />
      <Panel>
        <form style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 2fr) repeat(4, minmax(150px, 1fr))', gap: 14, alignItems: 'end' }} role="search">
          <Input name="q" placeholder="Search reports by title, domain, or project..." icon={<Search size={18} />} aria-label="Search reports" />
          <Field label="Project" htmlFor="r-project">
            <Select id="r-project" name="project" defaultValue="">
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Report Type" htmlFor="r-type">
            <Select id="r-type" name="type" defaultValue="">
              <option value="">All Types</option>
              {REPORT_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="r-status">
            <Select id="r-status" name="status" defaultValue="">
              <option value="">All Statuses</option>
              {REPORT_STATUSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date Range" htmlFor="r-range">
            <div style={{ position: 'relative' }}>
              <Select id="r-range" name="range" defaultValue="all" style={{ paddingLeft: 36 }}>
                <option value="all">All Time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </Select>
              <CalendarDays size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)', pointerEvents: 'none' }} />
            </div>
          </Field>
          <button type="submit" className="visually-hidden">
            Apply filters
          </button>
        </form>
      </Panel>
      <div style={{ height: 16 }} />
      <Panel bodyless>
        <DataTable
          columns={['Report Title', 'Type', 'Project / Domain', 'Generated', 'Status', 'Actions']}
          empty={
            <EmptyState
              icon={<FileSearch size={36} />}
              title="No reports found"
              description="Your generated reports will appear here."
              action={
                <ButtonLink href={generateHref} icon={<PlusCircle size={18} />} size="lg">
                  Generate a Report
                </ButtonLink>
              }
            />
          }
        />
      </Panel>
    </>
  );
}
