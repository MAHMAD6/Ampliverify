import Link from 'next/link';
import { BarChart3, CalendarDays, CircleAlert, CircleCheck, ExternalLink, FileSearch, ListChecks, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { Button, ButtonLink, Card, DataTable, EmptyState, Grid, IconCircle, Input, PageHeader, Panel, Select } from '@/components/ui';
import { ActionButton, AutoRefresh } from '@/components/ui/actions';
import { FindingActions } from '@/components/app/audit/AuditControls';
import { SeverityBadge } from '@/components/app/audit/FindingList';
import { TaskControls } from '@/components/app/audit/TaskControls';
import { getAppContext } from '@/lib/project';
import { apiGet, qs } from '@/lib/api';
import type { Member, Recommendations, TaskView } from '@/lib/app-types';
import { formatDateTime } from '@/lib/format';
import p from '@/components/app/pages.module.css';
import { appCrumbs } from '@/lib/nav';

export const metadata = { title: 'Optimization Center' };

const CATEGORIES = ['All', 'SEO', 'Content', 'AI Search (GEO)', 'Technical'];
const PRIORITY = ['', 'High', 'Medium', 'Low'];

/**
 * Optimization Center: open findings from each page's latest audit, tasks
 * created from them, and verification re-audits (guide §10: Audit →
 * Prioritize → Optimize → Verify).
 */
export default async function OptimizationCenterPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; priority?: string; status?: string; page?: string }> }) {
  const { selectedProject } = await getAppContext();
  const sp = await searchParams;
  const category = CATEGORIES.find((c) => c === sp.category) ?? 'All';
  const crumbs = appCrumbs(
    { label: 'My Projects', href: '/app/projects' },
    ...(selectedProject ? [{ label: selectedProject.name, href: `/app/projects/${selectedProject.id}` }] : []),
    { label: 'Optimization Center' },
  );

  if (!selectedProject) {
    return (
      <>
        <PageHeader title="Optimization Center" description="Manage and track all SEO, content, and AI search recommendations in one place." crumbs={crumbs} />
        <EmptyState icon={<FileSearch size={32} />} title="Select a project" description="Choose a project in the top bar to see its recommendations." action={<ButtonLink href="/app/projects">My Projects</ButtonLink>} />
      </>
    );
  }

  const pid = selectedProject.id;
  const [recs, tasks, members] = await Promise.all([
    apiGet<Recommendations>(`/user/projects/${pid}/recommendations${qs({ category: category === 'All' ? undefined : category, q: sp.q, priority: sp.priority, status: sp.status, page: sp.page })}`, { auth: true }),
    apiGet<TaskView[]>(`/user/projects/${pid}/tasks`, { auth: true }),
    apiGet<Member[]>(`/user/workspaces/${selectedProject.workspaceId}/members`, { auth: true }),
  ]);
  const data = recs.ok ? recs.data : null;
  const summary = data?.summary;
  const taskList = tasks.ok ? tasks.data : [];
  const verifying = taskList.some((t) => t.verifications.some((v) => v.status === 'QUEUED' || v.status === 'RUNNING'));
  const link = (extra: Record<string, string | undefined>) => `/app/optimize${qs({ category: category === 'All' ? undefined : category, q: sp.q, priority: sp.priority, status: sp.status, ...extra })}`;

  return (
    <>
      <AutoRefresh active={verifying} seconds={6} />
      <PageHeader
        title="Optimization Center"
        description="Manage and track all SEO, content, and AI search recommendations in one place."
        crumbs={crumbs}
        actions={
          <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: 14 }}>
                <CalendarDays size={18} color="var(--blue)" /> Last analyzed: {summary?.lastAnalyzedAt ? formatDateTime(summary.lastAnalyzedAt) : '—'}
              </span>
              <ActionButton variant="muted" icon={<RefreshCw size={16} />} path={`/user/projects/${pid}/reanalyze`} successMessage="Re-analysis started. Results appear when the audits finish.">
                Re-analyze Site
              </ActionButton>
            </div>
          </div>
        }
      />

      <Grid cols={4} style={{ marginBottom: 18 }}>
        {[
          { icon: <CircleAlert size={26} />, tone: 'red' as const, title: 'High Priority', text: 'Fix these first for the biggest impact.', color: 'var(--red)', value: summary?.high },
          { icon: <TriangleAlert size={26} />, tone: 'amber' as const, title: 'Medium Priority', text: 'Improve to strengthen performance.', color: '#ea7a0b', value: summary?.medium },
          { icon: <BarChart3 size={26} />, tone: 'blue' as const, title: 'Low Priority', text: 'Additional opportunities.', color: 'var(--blue)', value: summary?.low },
          { icon: <CircleCheck size={26} />, tone: 'green' as const, title: 'Verified', text: 'Fixes confirmed and completed.', color: 'var(--green)', value: summary?.verified },
        ].map((m) => (
          <Card key={m.title} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <IconCircle tone={m.tone} size={56}>
              {m.icon}
            </IconCircle>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value ?? '—'}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: m.color }}>{m.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{m.text}</div>
            </div>
          </Card>
        ))}
      </Grid>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {CATEGORIES.map((c) => (
          <ButtonLink key={c} href={`/app/optimize${qs({ category: c === 'All' ? undefined : c })}`} variant={c === category ? 'primary' : 'secondary'}>
            {c}
          </ButtonLink>
        ))}
        <form style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }} action="/app/optimize">
          {category !== 'All' && <input type="hidden" name="category" value={category} />}
          <Input name="q" defaultValue={sp.q} placeholder="Search recommendations..." icon={<Search size={18} />} aria-label="Search recommendations" style={{ width: 240 }} />
          <Select name="priority" defaultValue={sp.priority ?? ''} aria-label="Priority" style={{ width: 120 }}>
            {PRIORITY.map((v, i) => (
              <option key={v} value={i ? String(i) : ''}>
                {v || 'Priority'}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={sp.status ?? ''} aria-label="Status" style={{ width: 130 }}>
            <option value="">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="IGNORED">Ignored</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REGRESSED">Regressed</option>
          </Select>
          <Select name="page" defaultValue={sp.page ?? ''} aria-label="Page" style={{ width: 180 }}>
            <option value="">All pages</option>
            {(summary?.pages ?? []).map((u) => (
              <option key={u} value={u}>
                {u.replace(/^https?:\/\//, '')}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
      </div>

      <Panel bodyless>
        <DataTable
          columns={['Recommendation', 'Affected Page', 'Category', 'Priority', 'Status', 'Actions']}
          rows={(data?.items ?? []).map((f) => [
            <div key="t">
              <b>{f.title}</b>
              {f.guidance && <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 420 }}>{f.guidance}</div>}
            </div>,
            <a key="u" href={f.pageUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', wordBreak: 'break-all', fontSize: 13 }}>
              {f.pageUrl.replace(/^https?:\/\//, '')}
            </a>,
            f.categoryLabel,
            <SeverityBadge key="p" severity={f.severity} />,
            f.status.toLowerCase().replace('_', ' '),
            <FindingActions key="a" projectId={pid} finding={f} compact />,
          ])}
          empty={
            <EmptyState
              icon={<FileSearch size={32} />}
              title={summary?.lastRunId ? 'No recommendations match' : 'No recommendations yet'}
              description={
                summary?.lastRunId
                  ? 'Try another filter, or re-analyze the site to check for new issues.'
                  : 'Run an SEO audit to generate personalized recommendations for your website. You’ll see actionable fixes here to improve your SEO, content, and AI search visibility.'
              }
              action={
                <>
                  <ButtonLink href="/app/audit" icon={<ExternalLink size={18} />} size="lg">
                    Run SEO Audit
                  </ButtonLink>
                  {summary?.lastRunId && <Link href={link({ status: undefined, q: undefined, priority: undefined, page: undefined })}>Clear filters</Link>}
                </>
              }
            />
          }
        />
      </Panel>

      <div style={{ height: 16 }} />
      <Panel title={`Tasks (${taskList.length})`} flushHead bodyless>
        <DataTable
          columns={['Task', 'Priority', 'Due', 'Last verification', 'Manage']}
          rows={taskList.map((t) => [
            <div key="t">
              <b>{t.title}</b>
              {t.finding && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.finding.categoryLabel} · {t.finding.status.toLowerCase()}</div>}
            </div>,
            ['High', 'Medium', 'Low'][t.priority - 1] ?? '—',
            t.dueAt ? formatDateTime(t.dueAt) : '—',
            t.verifications[0] ? `${t.verifications[0].result ?? t.verifications[0].status.toLowerCase()} · ${formatDateTime(t.verifications[0].createdAt)}` : 'Not verified',
            <TaskControls key="c" task={t} members={members.ok ? members.data : []} />,
          ])}
          empty={<EmptyState compact icon={<ListChecks size={28} />} title="No tasks yet" description="Create a task from a recommendation to track the fix and verify it." />}
        />
      </Panel>

      <div style={{ height: 16 }} />
      <Panel title="How it works" flushHead>
        <div className={p.steps} style={{ textAlign: 'left', alignItems: 'stretch' }}>
          {[
            ['Analyze Your Site', 'Run an SEO audit to find opportunities across SEO, content, AI search (GEO), and technical areas.'],
            ['Review Recommendations', 'See prioritized recommendations with clear impact and guidance.'],
            ['Take Action', 'Open pages in the editor, make improvements, and mark progress as you go.'],
            ['Verify Fixes', 'Re-analyze your site to confirm completed fixes and track your improvement over time.'],
          ].map(([title, text], i) => (
            <div key={title} style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className={p.stepNum} style={{ background: 'var(--blue)', flexShrink: 0 }}>
                {i + 1}
              </span>
              <div>
                <h4 style={{ fontSize: 16 }}>{title}</h4>
                <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
