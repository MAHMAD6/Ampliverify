import { notFound } from 'next/navigation';
import { FileText, Layers, Search, Sparkles } from 'lucide-react';
import { ProjectHeader } from '@/components/app/projects/ProjectHeader';
import { Card, Grid, IconCircle, Panel } from '@/components/ui';
import { GenerateReportForm } from '@/components/app/reports/ReportControls';
import { ReportsTable } from '@/components/app/reports/ReportsTable';
import { apiGet } from '@/lib/api';
import type { Project } from '@/lib/types';
import type { ReportRow } from '@/lib/app-types';

export const metadata = { title: 'Project Reports' };

const TYPES = [
  { icon: <Search size={24} />, tone: 'blue' as const, title: 'SEO Report', text: 'Audit scores, top recommendations and task progress.' },
  { icon: <FileText size={24} />, tone: 'green' as const, title: 'Content Strategy Report', text: 'Your content plan and its status.' },
  { icon: <Sparkles size={24} />, tone: 'purple' as const, title: 'AI Search (GEO) Report', text: 'Visibility, citations and platforms for tracked prompts.' },
  { icon: <Layers size={24} />, tone: 'blue' as const, title: 'Executive Summary', text: 'SEO, AI search, tasks and content in one report (sections without data say so).' },
];

/** Project-scoped reports: generate, view, download and share. */
export default async function ProjectReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const result = await apiGet<Project>(`/user/projects/${encodeURIComponent(id)}`, { auth: true });
  if (!result.ok) notFound();
  const project = result.data;
  const reports = await apiGet<ReportRow[]>(`/user/reports?projectId=${project.id}`, { auth: true });

  return (
    <>
      <ProjectHeader
        project={project}
        active="reports"
        back={{ href: `/app/projects/${project.id}`, label: 'Back to Project Overview' }}
        description="Manage your project, run audits, create content strategies, track AI search visibility, and view reports."
      />
      <Grid cols={4} style={{ marginBottom: 16 }}>
        {TYPES.map((t) => (
          <Card key={t.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <IconCircle tone={t.tone} size={48}>
              {t.icon}
            </IconCircle>
            <div>
              <b>{t.title}</b>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>{t.text}</p>
            </div>
          </Card>
        ))}
      </Grid>
      <Panel title="Generate Report" description="Reports use this project's real data for the period you choose." flushHead>
        <GenerateReportForm projects={[{ id: project.id, name: project.name }]} defaultProjectId={project.id} />
      </Panel>
      <div style={{ height: 16 }} />
      <Panel title="Reports List" description="View, download, or share your generated reports." bodyless>
        <ReportsTable reports={reports.ok ? reports.data : []} />
      </Panel>
    </>
  );
}
