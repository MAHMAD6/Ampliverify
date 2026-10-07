import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BarChart3, CalendarDays, ChevronRight, Clock3, FileText, Globe, Info, Layers, Lightbulb, ListChecks, Search, Sparkles, Target } from 'lucide-react';
import { ProjectHeader } from '@/components/app/projects/ProjectHeader';
import { Badge, ButtonLink, Card, EmptyState, Field, Grid, IconCircle, Input, Panel, Select } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import type { Project } from '@/lib/types';
import type { BillingOverview, ProjectSummary, Recommendations } from '@/lib/app-types';
import p from '@/components/app/pages.module.css';

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '22px 130px 1fr', gap: 10, alignItems: 'center', padding: '7px 0', fontSize: 14 }}>
      <span style={{ color: 'var(--blue)' }}>{icon}</span>
      <span style={{ color: 'var(--heading)' }}>{label}</span>
      <span style={{ color: 'var(--muted)' }}>{value}</span>
    </div>
  );
}

type ProjectSettings = { locale: string; timezone: string; crawl: { crawlScope: string; maxPages: number; auditMode: string; auditFrequency: string; nextAuditAt?: string | null } };

const EVENT_LABEL: Record<string, string> = {
  'project.create': 'Project created',
  'project.update': 'Project updated',
  'project.audit.request': 'Audit started',
  'project.task.create': 'Task created',
  'project.task.update': 'Task updated',
  'project.finding.update': 'Recommendation updated',
  'project.geo.prompt.create': 'GEO prompt added',
  'project.geo.check': 'AI search check run',
  'project.report.generate': 'Report generated',
  'project.content.brief.create': 'Content brief created',
  'project.content.ideas.generate': 'Content ideas generated',
  'project.editor.create': 'Editor document created',
  'project.editor.publish': 'Page published',
  'project.settings.update': 'Settings updated',
};

/** Project overview hub: live module status, activity, opportunities, usage and settings. */
export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const result = await apiGet<Project>(`/user/projects/${encodeURIComponent(id)}`, { auth: true });
  if (!result.ok) notFound();
  const project = result.data;
  const [summaryRes, recsRes, settingsRes, billingRes] = await Promise.all([
    apiGet<ProjectSummary>(`/user/projects/${project.id}/summary`, { auth: true }),
    apiGet<Recommendations>(`/user/projects/${project.id}/recommendations`, { auth: true }),
    apiGet<ProjectSettings>(`/user/projects/${project.id}/settings`, { auth: true }),
    apiGet<BillingOverview>(`/user/workspaces/${project.workspaceId}/billing`, { auth: true }),
  ]);
  const sum = summaryRes.ok ? summaryRes.data : null;
  const recs = recsRes.ok ? recsRes.data.items.slice(0, 5) : [];
  const settings = settingsRes.ok ? settingsRes.data : null;
  const billing = billingRes.ok ? billingRes.data : null;

  const actions = [
    { icon: <Search size={22} />, tone: 'blue' as const, title: 'Run SEO Audit', text: 'Analyze a specific page for SEO issues and opportunities.', cta: 'Run Audit', href: '/app/audit' },
    { icon: <FileText size={22} />, tone: 'green' as const, title: 'Create Content Strategy', text: 'Analyze your domain to create and optimize content.', cta: 'Generate Strategy', href: '/app/content' },
    { icon: <Sparkles size={22} />, tone: 'purple' as const, title: 'Track AI Search (GEO)', text: 'Monitor your visibility in AI search experiences.', cta: 'Set Up Tracking', href: '/app/geo' },
    { icon: <Layers size={22} />, tone: 'blue' as const, title: 'View Reports', text: 'See insights, progress, and recommendations for this project.', cta: 'View Reports', href: `/app/projects/${project.id}/reports` },
  ];
  const modules = [
    {
      icon: <Search size={22} />,
      tone: 'blue' as const,
      title: 'SEO Audit',
      state: sum?.audit ? `Score ${sum.audit.scores?.overall ?? '—'}` : 'Not analyzed',
      rows: [
        ['Last Analyzed', sum?.audit?.completedAt ? formatDate(sum.audit.completedAt) : '—'],
        ['Open Issues', sum ? String(sum.issues.total) : '—'],
      ],
      cta: sum?.audit ? 'Run Again' : 'Run SEO Audit',
      href: '/app/audit',
    },
    {
      icon: <FileText size={22} />,
      tone: 'green' as const,
      title: 'Content Strategy',
      state: sum && sum.content.ideas + sum.content.briefs ? 'In progress' : 'Not started',
      rows: [
        ['Ideas', sum ? String(sum.content.ideas) : '—'],
        ['Briefs', sum ? String(sum.content.briefs) : '—'],
      ],
      cta: 'Open Strategy',
      href: '/app/content',
    },
    {
      icon: <Sparkles size={22} />,
      tone: 'purple' as const,
      title: 'AI Search (GEO)',
      state: sum?.geo.prompts ? (sum.geo.visibility !== null ? `${sum.geo.visibility}% visible` : 'Tracking') : 'Not configured',
      rows: [
        ['Last Checked', sum?.geo.lastCheckedAt ? formatDate(sum.geo.lastCheckedAt) : '—'],
        ['Prompts Tracked', sum ? String(sum.geo.prompts) : '—'],
      ],
      cta: sum?.geo.prompts ? 'View GEO' : 'Set Up Tracking',
      href: '/app/geo',
    },
  ];
  const usageOf = (k: string) => billing?.usage.find((u) => u.featureKey === k)?.units ?? 0;

  return (
    <>
      <ProjectHeader project={project} active="overview" description="Manage your project, run audits, create content strategies, and track your visibility." />

      <div className={p.twoThirds} style={{ gridTemplateColumns: 'minmax(0, 2.1fr) minmax(320px, 1fr)' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Project Actions" description="Choose a module to analyze, optimize, or track for this project." flushHead>
            <Grid cols={4}>
              {actions.map((a) => (
                <Card key={a.title} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <IconCircle tone={a.tone} size={44}>
                      {a.icon}
                    </IconCircle>
                    <strong style={{ color: 'var(--heading)', fontSize: 15 }}>{a.title}</strong>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--muted)', flex: 1 }}>{a.text}</p>
                  <ButtonLink href={a.href} block size="sm">
                    {a.cta} <ArrowRight size={16} />
                  </ButtonLink>
                </Card>
              ))}
            </Grid>
          </Panel>

          <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>Analysis Status <Info size={16} color="var(--muted)" /></span>} description="Overview of this project's latest analysis status." flushHead>
            <Grid cols={3}>
              {modules.map((m) => (
                <Card key={m.title} style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <IconCircle tone={m.tone} size={48}>
                      {m.icon}
                    </IconCircle>
                    <div>
                      <strong style={{ color: 'var(--heading)' }}>{m.title}</strong>
                      <div>
                        <Badge>{m.state}</Badge>
                      </div>
                    </div>
                  </div>
                  {m.rows.map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}>
                      {label} <span>{value}</span>
                    </div>
                  ))}
                  <ButtonLink href={m.href} variant="outline" block>
                    {m.cta}
                  </ButtonLink>
                </Card>
              ))}
            </Grid>
          </Panel>

          <Grid cols={2}>
            <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Clock3 size={20} color="var(--blue)" /> Recent Activity</span>} flushHead>
              {sum?.activity.length ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                  {sum.activity.slice(0, 8).map((a) => (
                    <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
                      <span>{EVENT_LABEL[a.eventType] ?? humanize(a.eventType.replace(/^project\./, '').replace(/\./g, ' '))}</span>
                      <span style={{ color: 'var(--muted)' }}>{formatDateTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={<FileText size={24} />} title="No activity yet" description="Your project activity will appear here after you run an audit, generate a strategy, or set up GEO tracking." />
              )}
            </Panel>
            <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Lightbulb size={20} color="var(--amber)" /> Top Opportunities</span>} actions={<Link href="/app/optimize" style={{ color: 'var(--blue)', fontSize: 14 }}>View All →</Link>} flushHead>
              {recs.length ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                  {recs.map((r) => (
                    <li key={r.id} style={{ fontSize: 14 }}>
                      <b>{r.title}</b>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{r.categoryLabel} · {r.pageUrl.replace(/^https?:\/\//, '')}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={<BarChart3 size={24} />} title="No insights yet" description="Run an audit or generate a content strategy to see key opportunities for this project." />
              )}
            </Panel>
          </Grid>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Project Details" flushHead>
            <Row icon={<Globe size={18} />} label="Domain" value={project.primaryDomain ?? 'Not set'} />
            <Row icon={<Target size={18} />} label="Primary Goal" value={project.primaryGoal ? humanize(project.primaryGoal) : 'Not selected'} />
            <Row icon={<CalendarDays size={18} />} label="Date Created" value={formatDate(project.createdAt)} />
            <Row icon={<Clock3 size={18} />} label="Last Updated" value={formatDate(project.updatedAt)} />
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--blue)', fontSize: 14 }}>Edit project</summary>
              <ApiForm method="PATCH" path={`/user/projects/${project.id}`} revalidate={[`/app/projects/${project.id}`]}>
                <Field label="Project name" htmlFor="pname">
                  <Input id="pname" name="name" defaultValue={project.name} required maxLength={160} />
                </Field>
              </ApiForm>
            </details>
          </Panel>

          <Panel title="Audit Settings" description="Defaults for audits and the automatic re-audit schedule." flushHead>
            <ApiForm method="PUT" path={`/user/projects/${project.id}/settings`} revalidate={[`/app/projects/${project.id}`]}>
              <Field label="Scope" htmlFor="scope">
                <Select id="scope" name="crawlScope" defaultValue={settings?.crawl.crawlScope ?? 'PAGE'}>
                  <option value="PAGE">Single page</option>
                  <option value="SITE">Whole site (crawl)</option>
                </Select>
              </Field>
              <Field label="Pages per site audit" htmlFor="maxPages">
                <Input id="maxPages" name="maxPages" type="number" min={1} max={200} data-type="number" defaultValue={settings?.crawl.maxPages ?? 25} />
              </Field>
              <Field label="Analyze for" htmlFor="auditMode">
                <Select id="auditMode" name="auditMode" defaultValue={settings?.crawl.auditMode ?? 'SEO'}>
                  <option value="SEO">Search (SEO)</option>
                  <option value="GEO">AI Search (GEO)</option>
                  <option value="BOTH">Both</option>
                </Select>
              </Field>
              <Field label="Automatic re-audit" htmlFor="freq" hint={settings?.crawl.nextAuditAt ? `Next run ${formatDateTime(settings.crawl.nextAuditAt)}` : undefined}>
                <Select id="freq" name="auditFrequency" defaultValue={settings?.crawl.auditFrequency ?? 'MANUAL'}>
                  <option value="MANUAL">Manual only</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </Select>
              </Field>
            </ApiForm>
          </Panel>

          <Panel
            title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>Workspace Usage <Info size={16} color="var(--muted)" /></span>}
            actions={<Link href="/app/usage" style={{ color: 'var(--blue)', fontSize: 14, fontWeight: 600 }}>View All Usage →</Link>}
            flushHead
          >
            {[
              ['Audit pages', billing ? String(usageOf('seo.audit_run')) : '—'],
              ['AI-assisted actions', billing ? String(usageOf('ai.action')) : '—'],
              ['GEO prompts tracked', sum ? String(sum.geo.prompts) : '—'],
              ['Current period', billing ? `${formatDate(billing.periodStart)} – ${billing.periodEnd ? formatDate(billing.periodEnd) : 'now'}` : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: 'var(--heading)' }}>
                {label} <span style={{ color: 'var(--muted)' }}>{value}</span>
              </div>
            ))}
          </Panel>

          <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><ListChecks size={20} color="var(--blue)" /> Next Steps</span>} flushHead>
            {[
              ['Run an SEO Audit for a key page.', '/app/audit', !!sum?.audit],
              ['Generate a content strategy for your domain.', '/app/content', !!sum && sum.content.ideas + sum.content.briefs > 0],
              ['Set up AI Search (GEO) tracking.', '/app/geo', !!sum?.geo.prompts],
              ['Review your reports and take action.', `/app/projects/${project.id}/reports`, !!sum?.reports],
            ].map(([text, href, done], i) => (
              <Link key={text as string} href={href as string} className={p.checkItem}>
                <span className={p.checkNum} style={done ? { background: 'var(--green)' } : undefined}>
                  {done ? '✓' : i + 1}
                </span>
                {text}
                <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
              </Link>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}
