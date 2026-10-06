import { notFound } from 'next/navigation';
import { BarChart3, CalendarDays, ChevronRight, Clock3, FileText, Layers, Lightbulb, Search, Sparkles } from 'lucide-react';
import { ProjectHeader } from '@/components/app/projects/ProjectHeader';
import { REPORT_STATUSES, REPORT_TYPES } from '@/components/app/reports/meta';
import { Badge, Button, DataTable, EmptyState, Field, Grid, IconCircle, Input, Panel, Select } from '@/components/ui';
import { apiGet } from '@/lib/api';
import type { Project } from '@/lib/types';
import pg from '@/components/app/pages.module.css';

export const metadata = { title: 'Project Reports' };

const TYPES = [
  { icon: <Search size={24} />, tone: 'blue' as const, title: 'SEO Report', text: 'Detailed analysis of page SEO issues, opportunities, and recommendations.' },
  { icon: <FileText size={24} />, tone: 'green' as const, title: 'Content Strategy Report', text: 'Summary of content opportunities and strategy recommendations.' },
  { icon: <Sparkles size={24} />, tone: 'purple' as const, title: 'AI Search (GEO) Report', text: 'Visibility analysis and tracked prompts for AI search experiences.' },
  { icon: <Layers size={24} />, tone: 'blue' as const, title: 'Combined Report', text: 'Comprehensive report including SEO, content strategy, and AI search insights (only includes modules with available data).' },
];

/** Project-scoped reports. Generating needs the reports API (not built yet); scheduling is "Coming Soon" per the design. */
export default async function ProjectReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const result = await apiGet<Project>(`/user/projects/${encodeURIComponent(id)}`, { auth: true });
  if (!result.ok) notFound();
  const project = result.data;

  return (
    <>
      <ProjectHeader
        project={project}
        active="reports"
        back={{ href: `/app/projects/${project.id}`, label: 'Back to Project Overview' }}
        description="Manage your project, run audits, create content strategies, track AI search visibility, and view reports."
      />
      <div className={pg.twoThirds} style={{ gridTemplateColumns: 'minmax(0, 2.1fr) minmax(320px, 1fr)' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel
            title={<span style={{ fontSize: 26, fontWeight: 800 }}>Reports</span>}
            description="Generate, view, and share reports for your project's SEO, content strategy, and AI search (GEO) insights."
            actions={
              <Button icon={<FileText size={18} />} disabled title="Report generation is not available yet">
                Generate Report
              </Button>
            }
            flushHead
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr)) minmax(180px, 1fr)', gap: 12, alignItems: 'end', marginBottom: 14 }}>
              <Field label="Report Type" htmlFor="pr-type">
                <Select id="pr-type" defaultValue="">
                  <option value="">All Reports</option>
                  {REPORT_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date Range" htmlFor="pr-range">
                <Select id="pr-range" defaultValue="30">
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="all">All Time</option>
                </Select>
              </Field>
              <Field label="Status" htmlFor="pr-status">
                <Select id="pr-status" defaultValue="">
                  <option value="">All Statuses</option>
                  {REPORT_STATUSES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <div style={{ marginBottom: 14 }}>
                <Input placeholder="Search reports..." icon={<Search size={16} />} aria-label="Search reports" />
              </div>
            </div>
            <Panel title="Reports List" description="View, download, or share your generated reports." bodyless>
              <DataTable
                selectable
                columns={['Report Name', 'Type', 'Date Generated', 'Status', 'Actions']}
                empty={
                  <EmptyState
                    icon={<FileText size={28} />}
                    title="No reports yet"
                    description="Generate a report to see a summary of your SEO, content strategy, or AI search (GEO) analysis."
                    action={
                      <Button disabled title="Report generation is not available yet">
                        Generate Your First Report
                      </Button>
                    }
                  />
                }
              />
            </Panel>
          </Panel>

          <Grid cols={2}>
            <Panel
              title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Clock3 size={20} color="var(--blue)" /> Recent Report Activity</span>}
              actions={<span style={{ color: 'var(--subtle)', fontSize: 14 }}>View All →</span>}
              flushHead
            >
              <EmptyState compact icon={<FileText size={24} />} title="No recent activity" description="Your report activity will appear here after you generate a report." />
            </Panel>
            <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Lightbulb size={20} color="var(--amber)" /> Report Insights</span>} description="Key takeaways from your latest reports." flushHead>
              <EmptyState compact icon={<BarChart3 size={24} />} title="No insights yet" description="Generate a report to see key findings and opportunities for this project." />
            </Panel>
          </Grid>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Report Types" description="Choose the right report for your needs." flushHead>
            <div style={{ display: 'grid', gap: 10 }}>
              {TYPES.map((t) => (
                <div key={t.title} style={{ display: 'flex', gap: 12, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }} title="Report generation is not available yet">
                  <IconCircle tone={t.tone} size={48}>
                    {t.icon}
                  </IconCircle>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: 'var(--heading)' }}>{t.title}</strong>
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>{t.text}</p>
                  </div>
                  <ChevronRight size={18} color="var(--muted)" />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Scheduled Reports" description="Set up automatic reports to stay informed." actions={<Badge tone="blue">Coming Soon</Badge>} flushHead>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12 }}>
              <EmptyState compact icon={<CalendarDays size={24} />} title="Scheduled reports will be available soon." description="Automatically generate and receive reports on your schedule." />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
