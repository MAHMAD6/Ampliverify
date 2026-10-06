import Link from 'next/link';
import {
  BarChart3,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Home,
  Info,
  ListChecks,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  FileBarChart,
} from 'lucide-react';
import { CreditsDonut } from '@/components/app/CreditsDonut';
import { ProjectPicker } from '@/components/app/ProjectPicker';
import { Button, ButtonLink, Card, DataTable, EmptyState, Grid, IconCircle, Input, Notice, PageHeader, Panel, TabNav } from '@/components/ui';
import { getAppContext } from '@/lib/project';
import p from '@/components/app/pages.module.css';

export const metadata = { title: 'AI Search (GEO) Monitoring' };

const PROJECT_TABS = [
  { key: 'overview', label: 'Overview', href: '/app/projects', icon: <Home size={20} /> },
  { key: 'audit', label: 'SEO Audit', href: '/app/audit', icon: <Search size={20} /> },
  { key: 'content', label: 'Content Strategy', href: '/app/content', icon: <FileText size={20} /> },
  { key: 'geo', label: 'AI Search (GEO)', href: '/app/geo', icon: <Sparkles size={20} /> },
  { key: 'reports', label: 'Reports', href: '/app/reports', icon: <FileBarChart size={20} /> },
  { key: 'settings', label: 'Settings', href: '/app/settings/project-defaults', icon: <Settings size={20} /> },
];

/**
 * Prompt monitoring (guide §9). The GEO API is not built yet, so with or
 * without a selected project every data area shows its empty state and
 * credit-consuming actions stay disabled. Platforms are never hard-coded.
 */
export default async function GeoPage() {
  const { projects, selectedProject } = await getAppContext();
  const selected = !!selectedProject;
  const pick = (withProject: string, without: string) => (selected ? withProject : without);

  const summary = [
    { icon: <MessageSquare size={22} />, tone: 'purple' as const, title: 'Saved Prompts', text: pick('No saved prompts yet.', 'Select a project to view your saved prompts.') },
    { icon: <Share2 size={22} />, tone: 'blue' as const, title: 'AI Search Providers', text: pick('No providers configured for this project.', 'Select a project to view configured providers.') },
    { icon: <Clock3 size={22} />, tone: 'blue' as const, title: 'Latest Checks', text: pick('No checks have run yet.', 'Select a project to view check history.') },
    { icon: <BarChart3 size={22} />, tone: 'purple' as const, title: 'Visibility Insights', text: pick('Insights appear after your first check.', 'Select a project to view insights.') },
  ];

  return (
    <>
      <PageHeader
        title="AI Search (GEO) Monitoring"
        description="Track how your brand appears in AI search experiences. Monitor saved prompts, see citations and mentions, and discover opportunities to improve visibility."
      />

      <Card style={{ marginBottom: 16 }}>
        <div className={p.projectBar}>
          <div>
            <h2>Select a Project</h2>
            <p>Choose a project to view and manage AI search monitoring.</p>
          </div>
          <ProjectPicker projects={projects} selectedId={selectedProject?.id} className={p.projectBarSelect} />
          <div className={p.projectBarActions}>
            {selectedProject ? (
              <ButtonLink href={`/app/projects/${selectedProject.id}`} variant="secondary">
                Manage Project
              </ButtonLink>
            ) : (
              <Button variant="muted" disabled>
                Manage Project
              </Button>
            )}
            <Button variant="secondary" aria-label="More actions" disabled>
              <MoreVertical size={18} />
            </Button>
          </div>
        </div>
      </Card>

      <TabNav tabs={PROJECT_TABS} active="geo" />

      <Grid cols={4} style={{ marginBottom: 16 }}>
        {summary.map((c) => (
          <Card key={c.title} className={p.summaryCard}>
            <IconCircle tone={c.tone} size={48}>
              {c.icon}
            </IconCircle>
            <div style={{ flex: 1 }}>
              <h3>{c.title}</h3>
              <div className={p.summaryValue}>—</div>
              <p className={p.summaryText}>{c.text}</p>
            </div>
            <ChevronRight size={18} color="var(--muted)" />
          </Card>
        ))}
      </Grid>

      <div className={p.twoThirds}>
        <Panel
          title="Tracked Prompts"
          description="Saved prompts are used for monitoring. Each check consumes GEO credits based on selected providers."
          bodyless
          actions={
            <div className={p.toolbar}>
              <Input placeholder="Search prompts..." icon={<Search size={16} />} disabled={!selected} aria-label="Search prompts" style={{ width: 200 }} />
              <Button variant="secondary" disabled icon={<Filter size={16} />}>
                Filters
              </Button>
            </div>
          }
        >
          <DataTable
            selectable
            columns={['Prompt', 'Providers', 'Frequency', 'Last Check', 'Status', 'Credits per Check', 'Actions']}
            empty={
              <EmptyState
                icon={<FileText size={28} />}
                title={pick('No tracked prompts yet', 'Select a project to view tracked prompts')}
                description={pick(
                  'Add the questions your audience asks AI assistants to start monitoring visibility.',
                  'Choose a project from the selector above to add and manage prompts for AI search monitoring.',
                )}
                action={
                  <Button variant="muted" icon={<Plus size={16} />} disabled>
                    Add Prompt
                  </Button>
                }
                hint={pick('Prompt monitoring is not available for this project yet.', 'Select a project to enable this action.')}
              />
            }
          />
        </Panel>

        <div style={{ display: 'grid', gap: 16 }}>
          <Panel
            title="Usage & Credits"
            actions={
              <Link href="/app/usage" style={{ color: 'var(--blue)', fontSize: 14, fontWeight: 600 }}>
                View Details →
              </Link>
            }
          >
            <div className={p.donutRow}>
              <CreditsDonut />
              <div className={p.legend}>
                <div className={p.legendRow}>
                  <span>
                    <i className={p.swatch} style={{ background: 'var(--ink)' }} /> Used this period
                  </span>
                  —
                </div>
                <div className={p.legendRow}>
                  <span>
                    <i className={p.swatch} style={{ background: 'var(--blue-100)' }} /> Remaining
                  </span>
                  —
                </div>
                <div className={`${p.legendRow} ${p.legendTotal}`}>
                  <span>Total period credits</span>—
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <Notice>
                GEO checks consume credits based on the providers you select.{' '}
                {pick('', 'Select a project to view your plan limits and usage. ')}
                <Link href="/app/billing" style={{ fontWeight: 700 }}>
                  View Plans →
                </Link>
              </Notice>
            </div>
          </Panel>

          <Panel title="Supported AI Search Providers">
            <Notice tone="neutral" icon={<Settings size={16} />}>
              Providers are shown based on your plan and project configuration.
            </Notice>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 12 }}>
              {pick('No providers are available for this project yet.', 'Select a project to view available providers.')}
            </p>
          </Panel>
        </div>
      </div>

      <div className={p.twoThirds} style={{ marginTop: 16, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(300px,0.9fr)' }}>
        <Panel title="How Monitoring Works" flushHead>
          <div className={p.steps}>
            {[
              { title: 'Add Prompts', text: 'Save the questions your audience asks.', color: 'var(--blue)' },
              { title: 'Run Checks', text: 'We check across selected providers.', color: 'var(--purple)' },
              { title: 'Analyze Results', text: 'See visibility, citations, and opportunities.', color: 'var(--blue)' },
            ].map((step, i, all) => (
              <div key={step.title} style={{ display: 'contents' }}>
                <div className={p.step}>
                  <span className={p.stepNum} style={{ background: step.color }}>
                    {i + 1}
                  </span>
                  <h4>{step.title}</h4>
                  <p>{step.text}</p>
                </div>
                {i < all.length - 1 && <ChevronRight className={p.stepArrow} size={20} />}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Visibility Overview" flushHead>
          <EmptyState
            compact
            icon={<ListChecks size={24} />}
            title="No visibility data yet"
            description="Select a project and run your first check to see charts, trends, and citation insights over time."
          />
        </Panel>

        <Panel title="Next Steps" flushHead>
          <div className={p.checklist}>
            {[
              { label: 'Select a project', href: '/app/projects', done: selected },
              { label: 'Add your first tracked prompt', href: '/app/geo/prompts' },
              { label: 'Run your first check', href: '/app/geo/history' },
              { label: 'Review visibility insights', href: '/app/geo/citations' },
            ].map((item, i, all) => {
              const current = all.findIndex((x) => !x.done) === i;
              return (
                <Link key={item.label} href={item.href} className={`${p.checkItem} ${current ? p.checkItemActive : ''}`}>
                  <span className={p.checkNum}>{item.done ? '✓' : i + 1}</span>
                  {item.label}
                  <ChevronRight size={16} />
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--subtle)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Info size={14} /> Trends are shown only after at least two comparable checks exist.
      </p>
    </>
  );
}
