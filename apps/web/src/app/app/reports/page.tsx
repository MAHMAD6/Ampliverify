import { Search } from 'lucide-react';
import { REPORT_STATUSES, REPORT_TYPES } from '@/components/app/reports/meta';
import { Button, Field, Input, PageHeader, Panel, Select } from '@/components/ui';
import { ReportsTabs } from '@/components/app/reports/ReportsTabs';
import { GenerateReportForm } from '@/components/app/reports/ReportControls';
import { ReportsTable } from '@/components/app/reports/ReportsTable';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { apiGet, qs } from '@/lib/api';
import type { ReportRow } from '@/lib/app-types';

export const metadata = { title: 'Report History' };

/** All generated reports across the user's projects, with filters and generation. */
export default async function ReportHistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; project?: string; type?: string; status?: string }> }) {
  const sp = await searchParams;
  const { projects, selectedProject } = await getAppContext();
  const res = await apiGet<ReportRow[]>(`/user/reports${qs({ projectId: sp.project, type: sp.type, status: sp.status })}`, { auth: true });
  const term = sp.q?.trim().toLowerCase();
  const reports = (res.ok ? res.data : []).filter((r) => !term || r.title.toLowerCase().includes(term) || r.project.name.toLowerCase().includes(term));
  return (
    <>
      <PageHeader title="Report History" description="View, download, share, and manage all generated reports." crumbs={appCrumbs({ label: 'Reports', href: '/app/reports' }, { label: 'Report History' })} />
      <ReportsTabs active="all" />
      <Panel title="Generate a report" description="Reports summarize your project's real data for the period you choose." flushHead>
        <GenerateReportForm projects={projects} defaultProjectId={selectedProject?.id} />
      </Panel>
      <div style={{ height: 16 }} />
      <Panel>
        <form style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 2fr) repeat(3, minmax(150px, 1fr)) auto', gap: 14, alignItems: 'end' }} role="search">
          <Input name="q" defaultValue={sp.q} placeholder="Search reports by title or project..." icon={<Search size={18} />} aria-label="Search reports" />
          <Field label="Project" htmlFor="r-project">
            <Select id="r-project" name="project" defaultValue={sp.project ?? ''}>
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Report Type" htmlFor="r-type">
            <Select id="r-type" name="type" defaultValue={sp.type ?? ''}>
              <option value="">All Types</option>
              {REPORT_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="r-status">
            <Select id="r-status" name="status" defaultValue={sp.status ?? ''}>
              <option value="">All Statuses</option>
              {REPORT_STATUSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary" style={{ marginBottom: 14 }}>
            Filter
          </Button>
        </form>
      </Panel>
      <div style={{ height: 16 }} />
      <Panel bodyless>
        <ReportsTable reports={reports} />
      </Panel>
    </>
  );
}
