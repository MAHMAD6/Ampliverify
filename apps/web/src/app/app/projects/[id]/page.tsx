import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Globe,
  Home,
  Info,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Pencil,
  Search,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react';
import { ProjectHeader } from '@/components/app/projects/ProjectHeader';
import { Badge, ButtonLink, Card, EmptyState, Grid, IconCircle, Panel } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Project } from '@/lib/types';
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

/**
 * Project overview hub. Project facts are live; module status, activity,
 * opportunities and usage come from APIs that are not built yet, so they show
 * "Not analyzed" / "Not configured" and "—".
 */
export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const result = await apiGet<Project>(`/user/projects/${encodeURIComponent(id)}`, { auth: true });
  if (!result.ok) notFound();
  const project = result.data;

  const actions = [
    { icon: <Search size={22} />, tone: 'blue' as const, title: 'Run SEO Audit', text: 'Analyze a specific page for SEO issues and opportunities.', cta: 'Run Audit', href: '/app/audit' },
    { icon: <FileText size={22} />, tone: 'green' as const, title: 'Create Content Strategy', text: 'Analyze your domain to create and optimize content.', cta: 'Generate Strategy', href: '/app/content-strategy' },
    { icon: <Sparkles size={22} />, tone: 'purple' as const, title: 'Track AI Search (GEO)', text: 'Monitor your visibility in AI search experiences.', cta: 'Set Up Tracking', href: '/app/geo' },
    { icon: <Layers size={22} />, tone: 'blue' as const, title: 'View Reports', text: 'See insights, progress, and recommendations for this project.', cta: 'View Reports', href: `/app/projects/${project.id}/reports` },
  ];
  const modules = [
    { icon: <Search size={22} />, tone: 'blue' as const, title: 'SEO Audit', state: 'Not analyzed', rows: ['Last Analyzed', 'Pages Analyzed'], cta: 'Run SEO Audit', href: '/app/audit' },
    { icon: <FileText size={22} />, tone: 'green' as const, title: 'Content Strategy', state: 'Not analyzed', rows: ['Last Generated', 'Recommendations'], cta: 'Create Strategy', href: '/app/content-strategy' },
    { icon: <Sparkles size={22} />, tone: 'purple' as const, title: 'AI Search (GEO)', state: 'Not configured', rows: ['Last Updated', 'Prompts Tracked'], cta: 'Set Up Tracking', href: '/app/geo' },
  ];

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
                  <ButtonLink href={a.href} block size="sm" icon={undefined}>
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
                  {m.rows.map((r) => (
                    <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}>
                      {r} <span>—</span>
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
            <Panel
              title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Clock3 size={20} color="var(--blue)" /> Recent Activity</span>}
              actions={<span style={{ color: 'var(--subtle)', fontSize: 14 }}>View All →</span>}
              flushHead
            >
              <EmptyState compact icon={<FileText size={24} />} title="No activity yet" description="Your project activity will appear here after you run an audit, generate a strategy, or set up GEO tracking." />
            </Panel>
            <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Lightbulb size={20} color="var(--amber)" /> Top Opportunities</span>} flushHead>
              <EmptyState compact icon={<BarChart3 size={24} />} title="No insights yet" description="Run an audit or generate a content strategy to see key opportunities for this project." />
            </Panel>
          </Grid>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Project Details" actions={<span title="Project editing will be available soon" style={{ color: 'var(--subtle)', fontSize: 14, display: 'inline-flex', gap: 6 }}><Pencil size={16} /> Edit</span>} flushHead>
            <Row icon={<CalendarDays size={18} />} label="Project Name" value={<span style={{ color: 'var(--blue)' }}>{project.name}</span>} />
            <Row icon={<Globe size={18} />} label="Domain" value={project.primaryDomain ?? 'Not set'} />
            <Row icon={<Link2 size={18} />} label="Tags" value="Not set" />
            <Row icon={<Target size={18} />} label="Primary Goal" value="Not selected" />
            <Row icon={<CalendarDays size={18} />} label="Date Created" value={formatDate(project.createdAt)} />
            <Row icon={<Clock3 size={18} />} label="Last Updated" value={formatDate(project.updatedAt)} />
          </Panel>

          <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>Analysis Tools <Info size={16} color="var(--muted)" /></span>} flushHead>
            {modules.map((m) => (
              <Link key={m.title} href={m.href} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
                <IconCircle tone={m.tone} size={36}>
                  {m.icon}
                </IconCircle>
                <span style={{ flex: 1, color: 'var(--heading)' }}>{m.title}</span>
                <Badge>{m.state}</Badge>
                <ChevronRight size={18} color="var(--muted)" />
              </Link>
            ))}
          </Panel>

          <Panel
            title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>Usage for This Project <Info size={16} color="var(--muted)" /></span>}
            actions={<Link href="/app/usage" style={{ color: 'var(--blue)', fontSize: 14, fontWeight: 600 }}>View All Usage →</Link>}
            flushHead
          >
            {['Audits Used', 'Content Credits Used', 'GEO Prompts Tracked', 'Current Period'].map((u) => (
              <div key={u} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: 'var(--heading)' }}>
                {u} <span style={{ color: 'var(--muted)' }}>—</span>
              </div>
            ))}
          </Panel>

          <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><ListChecks size={20} color="var(--blue)" /> Next Steps</span>} flushHead>
            {[
              ['Run an SEO Audit for a key page.', '/app/audit'],
              ['Generate a content strategy for your domain.', '/app/content-strategy'],
              ['Set up AI Search (GEO) tracking.', '/app/geo'],
              ['Review your reports and take action.', `/app/projects/${project.id}/reports`],
            ].map(([text, href], i) => (
              <Link key={text} href={href} className={p.checkItem}>
                <span className={p.checkNum}>{i + 1}</span>
                {text}
              </Link>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}
