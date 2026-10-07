import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileBarChart,
  FileText,
  Folder,
  Info,
  Layers,
  Lightbulb,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  ChevronRight,
} from 'lucide-react';
import { ButtonLink, PageHeader } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { NextSteps, type Step } from '@/components/app/dashboard/NextSteps';
import { ProjectRowActions } from '@/components/app/projects/ProjectRowActions';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import type { Project } from '@/lib/types';
import type { BillingOverview, NotificationItem, ProjectSummary, Recommendations, ReportRow } from '@/lib/app-types';
import { formatDate, formatDateTime } from '@/lib/format';
import s from '@/components/app/dashboard/dashboard.module.css';

export const metadata = { title: 'Dashboard' };

const PERIODS = [
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
] as const;

const STATUS: Record<Project['status'], { label: string; tone: string }> = {
  ACTIVE: { label: 'Active', tone: 'green' },
  PAUSED: { label: 'Paused', tone: 'slate' },
  ARCHIVED: { label: 'Archived', tone: 'slate' },
};

/** Usage rows from the design, mapped to usage feature keys and plan limits. */
const USAGE = [
  { label: 'SEO Audits', key: 'seo.audit_run', limit: 'limit.audit_runs', icon: <Search size={18} />, tone: 'blue' },
  { label: 'AI Content Generations', key: 'ai.action', limit: 'limit.ai_actions', icon: <FileText size={18} />, tone: 'green' },
  { label: 'GEO Queries', key: 'geo.check', limit: 'limit.geo_queries', icon: <Sparkles size={18} />, tone: 'purple' },
  { label: 'Keyword Lookups', key: 'keywords.lookup', limit: 'limit.keyword_lookups', icon: <Layers size={18} />, tone: 'navy' },
];

const RESOURCES = [
  { title: 'Getting Started Guide', text: 'Learn the basics and set up your first project.', href: '/app/getting-started', icon: <BookOpen size={20} />, tone: 'blue' },
  { title: 'Guides & Tutorials', text: 'Step-by-step guides for every feature.', href: '/guides', icon: <PlayCircle size={20} />, tone: 'blue' },
  { title: 'Help Center', text: 'Find answers to common questions.', href: '/help', icon: <FileText size={20} />, tone: 'purple' },
  { title: 'Blog', text: 'Tips, best practices, and product updates.', href: '/blog', icon: <Users size={20} />, tone: 'blue' },
];

type DashboardRow = Project & { lastAuditAt: string | null; seoScore: number | null; geoScore: number | null; highIssues: number | null; openTasks: number };

function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>{icon}</span>
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </div>
  );
}

function Section({ title, href, linkLabel = 'View all', children, className }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${s.panel} ${className ?? ''}`}>
      <header className={s.panelHead}>
        <h2>{title}</h2>
        {href && (
          <Link href={href} className={s.viewAll}>
            {linkLabel} <ArrowRight size={16} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function ListLink({ href, icon, tone, title, text }: { href: string; icon: React.ReactNode; tone: string; title: string; text: string }) {
  return (
    <li>
      <Link href={href}>
        <span className={s.usageIcon} data-tone={tone}>
          {icon}
        </span>
        <span>
          <b>{title}</b>
          <small>{text}</small>
        </span>
        <ChevronRight size={18} />
      </Link>
    </li>
  );
}

const healthColor = (n: number | null | undefined) => (n === null || n === undefined ? undefined : n >= 80 ? '#16B364' : n >= 50 ? '#f59e0b' : '#dc2626');

/**
 * Dashboard (chat designs 2026-10-06: empty and populated; state behavior from
 * user-app-batch2a/01). Live: projects with SEO health, the selected
 * project's audits/content/GEO, usage against plan limits, activity, top
 * opportunities and recent reports.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period = '30d' } = await searchParams;
  const { signedIn, projects, selectedProject, workspaceId } = await getAppContext();
  const hasProjects = projects.length > 0;
  const active = projects.filter((p) => p.status === 'ACTIVE').length;
  const pid = selectedProject?.id;

  const [rowsRes, summaryRes, billingRes, notesRes, recsRes, reportsRes] = await Promise.all([
    signedIn ? apiGet<DashboardRow[]>('/user/dashboard', { auth: true }) : null,
    pid ? apiGet<ProjectSummary>(`/user/projects/${pid}/summary`, { auth: true }) : null,
    workspaceId ? apiGet<BillingOverview>(`/user/workspaces/${workspaceId}/billing`, { auth: true }) : null,
    signedIn ? apiGet<NotificationItem[]>('/user/notifications?limit=6', { auth: true }) : null,
    pid ? apiGet<Recommendations>(`/user/projects/${pid}/recommendations`, { auth: true }) : null,
    signedIn ? apiGet<ReportRow[]>('/user/reports', { auth: true }) : null,
  ]);
  const rows = rowsRes?.ok ? rowsRes.data : [];
  const summary = summaryRes?.ok ? summaryRes.data : null;
  const billing = billingRes?.ok ? billingRes.data : null;
  const notes = notesRes?.ok ? notesRes.data : [];
  const recs = recsRes?.ok ? recsRes.data.items.slice(0, 4) : [];
  const reports = reportsRes?.ok ? reportsRes.data.slice(0, 4) : [];
  const rowOf = (id: string) => rows.find((r) => r.id === id);
  const usageOf = (key: string) => billing?.usage.find((u) => u.featureKey === key)?.units ?? 0;
  const limitOf = (key: string) => billing?.limits.find((l) => l.featureKey === key)?.limit ?? null;

  const metrics = [
    { label: 'Total Projects', value: signedIn ? projects.length : null, href: '/app/projects', link: 'View all projects', icon: <Folder size={26} />, tone: 'blue' },
    { label: 'Active Projects', value: signedIn ? active : null, href: '/app/projects?tab=active', link: 'View active projects', icon: <CheckCircle2 size={26} />, tone: 'green' },
    { label: 'SEO Audits Run', value: summary ? summary.audits : null, href: '/app/audit', link: 'Run an audit', icon: <Search size={26} />, tone: 'purple' },
    { label: 'Content Strategies', value: summary ? summary.content.ideas + summary.content.briefs : null, href: '/app/content', link: 'Create a strategy', icon: <FileText size={26} />, tone: 'amber' },
    {
      label: 'AI Search (GEO)',
      value: summary ? (summary.geo.visibility !== null ? `${summary.geo.visibility}%` : `${summary.geo.prompts} prompts`) : null,
      href: '/app/geo',
      link: hasProjects ? 'View GEO' : 'Set up monitoring',
      icon: <Sparkles size={26} />,
      tone: 'blue',
    },
  ];

  const steps: Step[] = [
    { key: 'audit', title: 'Run an SEO Audit', text: 'Find and fix on-page issues on your website.', href: '/app/audit', cta: 'Run Audit', icon: <Search size={20} />, tone: 'blue', done: !!summary?.audits },
    { key: 'content', title: 'Create a Content Strategy', text: 'Get AI-powered topic and content ideas.', href: '/app/content', cta: 'Create Strategy', icon: <FileText size={20} />, tone: 'green', done: !!summary && summary.content.ideas + summary.content.briefs > 0 },
    { key: 'geo', title: 'Set Up AI Search (GEO)', text: 'Monitor your visibility in AI search experiences.', href: '/app/geo', cta: 'Set Up', icon: <Sparkles size={20} />, tone: 'purple', done: !!summary?.geo.prompts },
    hasProjects
      ? { key: 'project', title: 'Add Another Project', text: 'Track a new website or domain.', href: '/app/projects/new', cta: 'Add Project', icon: <Plus size={20} />, tone: 'blue', done: projects.length > 1 }
      : { key: 'project', title: 'Add Your First Project', text: 'Track a new website or domain.', href: '/app/projects/new', cta: 'Add Project', icon: <Plus size={20} />, tone: 'blue', done: false },
  ];

  return (
    <>
      <PageHeader
        title="Welcome back!"
        description="Track your projects, run audits, create content, and monitor your visibility — all in one place."
        actions={
          <>
            {hasProjects && (
              <form className={s.period}>
                <AutoSubmitSelect name="period" defaultValue={period} aria-label="Reporting period">
                  {PERIODS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </AutoSubmitSelect>
                <noscript>
                  <button type="submit">Apply</button>
                </noscript>
              </form>
            )}
            <ButtonLink href="/app/projects/new" icon={<Plus size={18} />}>
              Add Project
            </ButtonLink>
          </>
        }
      />

      <div className={s.metrics}>
        {metrics.map((m) => (
          <div key={m.label} className={s.metric}>
            <span className={s.metricIcon} data-tone={m.tone}>
              {m.icon}
            </span>
            <div>
              <span className={s.metricLabel}>{m.label}</span>
              <strong>{m.value ?? '—'}</strong>
              <Link href={m.href} className={s.metricLink}>
                {m.link} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className={s.mainRow}>
        {hasProjects ? (
          <Section title="Project Performance" href="/app/projects">
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>SEO Health</th>
                    <th>Last Analyzed</th>
                    <th className={s.right}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.slice(0, 5).map((p) => {
                    const row = rowOf(p.id);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className={s.project}>
                            <span className={s.avatar} aria-hidden>
                              {p.name.charAt(0).toUpperCase()}
                            </span>
                            <span>
                              <Link href={`/app/projects/${p.id}`}>{p.name}</Link>
                              <small>{p.primaryDomain ?? '—'}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={s.status} data-tone={STATUS[p.status].tone}>
                            {STATUS[p.status].label}
                          </span>
                        </td>
                        <td>
                          <span className={s.health}>
                            <i aria-hidden style={{ background: healthColor(row?.seoScore) }} /> {row?.seoScore !== null && row?.seoScore !== undefined ? `${row.seoScore}/100` : 'Not analyzed'}
                            {row?.highIssues ? ` · ${row.highIssues} high` : ''}
                          </span>
                        </td>
                        <td>{row?.lastAuditAt ? formatDate(row.lastAuditAt) : '—'}</td>
                        <td className={s.right}>
                          <ProjectRowActions project={p} openLabel="Open" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        ) : (
          <Section title="Your Projects" href="/app/projects">
            <Empty
              icon={<Folder size={34} />}
              title="No projects yet"
              text="Add a website or domain to start running SEO audits, creating content strategies, and tracking your progress."
              action={
                <div className={s.emptyActions}>
                  <ButtonLink href="/app/projects/new" icon={<Plus size={18} />}>
                    Add Project
                  </ButtonLink>
                  <Link href="/app/getting-started" className={s.viewAll}>
                    Learn how to get started <ArrowRight size={16} />
                  </Link>
                </div>
              }
            />
          </Section>
        )}
        <NextSteps steps={steps} numbered={!hasProjects} />
      </div>

      <div className={s.row3}>
        <Section title="Recent Activity" href="/app/notifications">
          {notes.length ? (
            <ul className={s.resources}>
              {notes.map((n) => (
                <ListLink key={n.id} href="/app/notifications" icon={<Clock3 size={18} />} tone={n.readAt ? 'navy' : 'blue'} title={n.title} text={`${n.body.slice(0, 90)} · ${formatDateTime(n.createdAt)}`} />
              ))}
            </ul>
          ) : (
            <Empty icon={<Clock3 size={28} />} title="No recent activity yet" text="Your project activity, audits, and updates will appear here." />
          )}
        </Section>
        <Section title="Usage & Credits" href="/app/usage" linkLabel="View details">
          <ul className={s.usage}>
            {USAGE.map((u) => {
              const limit = limitOf(u.limit);
              const used = usageOf(u.key);
              return (
                <li key={u.label}>
                  <span className={s.usageIcon} data-tone={u.tone}>
                    {u.icon}
                  </span>
                  <span className={s.usageBody}>
                    <small>{u.label}</small>
                    <span className={s.usageBar}>
                      {limit ? <i style={{ display: 'block', height: '100%', borderRadius: 'inherit', background: 'var(--blue)', width: `${Math.min(100, (used / limit) * 100)}%` }} /> : null}
                    </span>
                  </span>
                  <b>
                    {billing ? used : '—'} / {limit ?? (billing ? '∞' : '—')}
                  </b>
                </li>
              );
            })}
          </ul>
          <div className={s.capacity}>
            <Info size={20} />
            <span>
              <b>{billing ? `${Number(billing.credits.balance)} credits available` : 'Need more capacity?'}</b>
              <small>{billing?.plan.name ? `${billing.plan.name} plan` : 'Upgrade your plan to get more credits and features.'}</small>
            </span>
            <ButtonLink href="/app/billing" variant="outline" size="sm">
              Upgrade Plan
            </ButtonLink>
          </div>
        </Section>
        {hasProjects ? (
          <Section title="Insights & Alerts" href="/app/optimize">
            {summary && (summary.issues.critical + summary.issues.high > 0 || summary.tasks.open > 0 || billing?.credits.low) ? (
              <ul className={s.resources}>
                {summary.issues.critical + summary.issues.high > 0 && (
                  <ListLink href="/app/optimize?priority=1" icon={<Bell size={18} />} tone="purple" title={`${summary.issues.critical + summary.issues.high} high-priority issues`} text="Fix these first for the biggest impact." />
                )}
                {summary.tasks.open > 0 && <ListLink href="/app/optimize" icon={<CheckCircle2 size={18} />} tone="blue" title={`${summary.tasks.open} open tasks`} text={`${summary.tasks.verified} fixes verified so far.`} />}
                {billing?.credits.low && <ListLink href="/app/usage" icon={<Info size={18} />} tone="amber" title="Credits are running low" text={`${Number(billing.credits.balance)} credits left.`} />}
              </ul>
            ) : (
              <Empty icon={<Bell size={28} />} title="No insights or alerts yet" text="We’ll show important insights, opportunities, and alerts here when data is available." />
            )}
          </Section>
        ) : (
          <Section title="Resources" href="/help">
            <ul className={s.resources}>
              {RESOURCES.map((r) => (
                <ListLink key={r.title} href={r.href} icon={r.icon} tone={r.tone} title={r.title} text={r.text} />
              ))}
            </ul>
          </Section>
        )}
      </div>

      {hasProjects && (
        <div className={s.row3}>
          <Section title="Top Opportunities" href="/app/optimize">
            {recs.length ? (
              <ul className={s.resources}>
                {recs.map((r) => (
                  <ListLink key={r.id} href="/app/optimize" icon={<Lightbulb size={18} />} tone={r.priority === 1 ? 'purple' : 'blue'} title={r.title} text={r.pageUrl.replace(/^https?:\/\//, '')} />
                ))}
              </ul>
            ) : (
              <Empty icon={<Lightbulb size={28} />} title="No opportunities yet" text="Run an SEO audit or create a content strategy to see personalized opportunities." />
            )}
          </Section>
          <Section title="Recent Reports" href="/app/reports">
            {reports.length ? (
              <ul className={s.resources}>
                {reports.map((r) => (
                  <ListLink key={r.id} href={`/app/reports/${r.id}`} icon={<FileBarChart size={18} />} tone="green" title={r.title} text={`${r.status.toLowerCase()} · ${formatDate(r.createdAt)}`} />
                ))}
              </ul>
            ) : (
              <Empty icon={<FileBarChart size={28} />} title="No reports yet" text="Generated reports for your projects will appear here." />
            )}
          </Section>
          <Section title="GEO Visibility" href="/app/geo">
            {summary?.geo.prompts ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <strong style={{ fontSize: 32 }}>{summary.geo.visibility !== null ? `${summary.geo.visibility}%` : '—'}</strong>
                <small style={{ color: 'var(--muted)' }}>
                  Visibility across {summary.geo.prompts} tracked prompt(s){summary.geo.lastCheckedAt ? ` · last checked ${formatDate(summary.geo.lastCheckedAt)}` : ' · not checked yet'}
                </small>
                {summary.geo.citationRate !== null && <small>Cited as a source in {summary.geo.citationRate}% of answers</small>}
              </div>
            ) : (
              <Empty icon={<TrendingUp size={28} />} title="No GEO data yet" text="Set up AI Search (GEO) to start tracking your visibility." />
            )}
          </Section>
        </div>
      )}
    </>
  );
}
