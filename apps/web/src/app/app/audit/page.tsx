import Link from 'next/link';
import { BarChart3, ChevronRight, ClipboardList, FileText, History, Info, Lightbulb, Link2, Loader2, Search, Settings, Sparkles, Target } from 'lucide-react';
import { EmptyState, Notice, PageHeader } from '@/components/ui';
import { AutoRefresh, ActionButton } from '@/components/ui/actions';
import { ProjectContext } from '@/components/app/ModuleSetup';
import { RunAuditForm } from '@/components/app/audit/AuditControls';
import { FindingList } from '@/components/app/audit/FindingList';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import type { AuditDetail, AuditRunView, Finding } from '@/lib/app-types';
import { formatDateTime } from '@/lib/format';
import s from '@/components/app/audit.module.css';

export const metadata = { title: 'On-Page SEO Audit' };

const MODES = [
  ['seo', 'Search (SEO)', <Search key="s" size={16} />],
  ['geo', 'AI Search (GEO)', <Sparkles key="g" size={16} />],
  ['both', 'Both', <BarChart3 key="b" size={16} />],
] as const;

const TABS = ['Overview', 'Recommendations', 'Content', 'Technical', 'AI Search (GEO)', 'Content Strategy', 'Competitors'];

const tone = (n: number | null | undefined) => (n === null || n === undefined ? '#cbd5e1' : n >= 80 ? '#16B364' : n >= 50 ? '#f59e0b' : '#dc2626');

/**
 * On-Page SEO Audit (chat design 2026-10-06; states from user-app-batch2a/03).
 * Runs real audits (crawler + rule engine in apps/api) and shows the latest
 * run for the URL: scores, page overview, prioritized findings by category.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ url?: string; mode?: string; tab?: string; run?: string }> }) {
  const { url, mode = 'seo', tab = 'Overview', run } = await searchParams;
  const { selectedProject, projects } = await getAppContext();
  const project = selectedProject ?? (projects.length === 1 ? projects[0] : null);

  if (!project) {
    return (
      <>
        <PageHeader title="On-Page SEO Audit" description="Analyze your page for SEO, AI search visibility, and content." />
        <EmptyState
          icon={<ClipboardList size={32} />}
          title={projects.length ? 'Select a project' : 'Create a project first'}
          description={projects.length ? 'Choose a project in the top bar to audit its pages.' : 'Audits run on a project’s website. Add your first project to get started.'}
          action={<Link href={projects.length ? '/app/projects' : '/app/projects/new'}>{projects.length ? 'Go to My Projects' : 'Add Project'}</Link>}
        />
      </>
    );
  }

  const pageUrl = url ?? (project.primaryDomain ? `https://${project.primaryDomain}/` : '');
  const active = TABS.includes(tab) ? tab : 'Overview';
  const q = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(pageUrl && { url: pageUrl }), mode, ...(run && { run }), ...extra })}`;

  const detail = run
    ? await apiGet<AuditDetail>(`/user/audits/${encodeURIComponent(run)}`, { auth: true })
    : await apiGet<AuditDetail | null>(`/user/projects/${project.id}/audits/latest${pageUrl ? `?url=${encodeURIComponent(pageUrl)}` : ''}`, { auth: true });
  const audit = detail.ok ? detail.data : null;
  const history = await apiGet<AuditRunView[]>(`/user/projects/${project.id}/audits?limit=10`, { auth: true });
  const running = audit?.status === 'QUEUED' || audit?.status === 'RUNNING';
  const findings: Finding[] = audit?.status === 'SUCCEEDED' ? audit.pages.flatMap((p) => p.findings).filter((f) => f.severity !== 'INFO' || active !== 'Overview') : [];
  const byCategory = (c: string) => findings.filter((f) => f.category === c);
  const top = findings.filter((f) => f.status !== 'IGNORED' && f.status !== 'RESOLVED').sort((a, b) => a.priority - b.priority).slice(0, 5);
  const scores = audit?.status === 'SUCCEEDED' ? audit.scores : null;

  const SCORES = [
    { label: 'SEO Score', value: scores?.seo, text: 'Titles, descriptions, headings and structured data.' },
    { label: 'AI Search Visibility', value: scores?.geo, text: 'Entity clarity, answers, sources and structure for AI answers.' },
    { label: 'Content Score', value: scores?.content, text: 'Depth, images, internal links and duplication.' },
    { label: 'Technical Score', value: scores?.technical, text: 'Crawlability, status codes, HTTPS, speed and mobile.' },
  ];

  return (
    <>
      <ProjectContext project={project} />
      <AutoRefresh active={running} />
      <PageHeader title="On-Page SEO Audit" description="Analyze your page for SEO, AI search visibility, and content. Get actionable recommendations to improve and verify your results." />
      <RunAuditForm projectId={project.id} defaultUrl={pageUrl} mode={mode} />
      <div className={s.modes}>
        <b>
          Analyze for <Info size={14} />
        </b>
        {MODES.map(([k, l, i]) => (
          <Link key={k} href={q({ mode: k })} className={mode === k ? s.modeOn : undefined} aria-current={mode === k}>
            {i} {l}
          </Link>
        ))}
        <small>SEO = Traditional search optimization · GEO = Generative Engine Optimization</small>
      </div>

      {running && (
        <Notice tone="blue" title="Analyzing…">
          <Loader2 size={14} style={{ verticalAlign: 'middle' }} /> We are fetching {audit?.request?.url} and running {audit?.request?.scope === 'SITE' ? 'a site' : 'a page'} audit. This page updates automatically.{' '}
          <ActionButton size="sm" variant="ghost" path={`/user/audits/${audit!.id}/cancel`}>
            Cancel
          </ActionButton>
        </Notice>
      )}
      {audit?.status === 'FAILED' && (
        <Notice tone="amber" title="The audit could not be completed">
          {audit.error ?? 'The page could not be fetched.'} No credits were used.
        </Notice>
      )}

      <div className={s.scores}>
        {SCORES.map((sc) => (
          <div key={sc.label} className={s.score}>
            <span className={s.ring} style={{ borderColor: tone(sc.value) }}>
              {sc.value ?? '—'}
            </span>
            <span>
              <b>{sc.label}</b>
              <em>{sc.value === undefined || sc.value === null ? 'Not analyzed yet' : sc.value >= 80 ? 'Good' : sc.value >= 50 ? 'Needs improvement' : 'Poor'}</em>
              <small>{sc.text}</small>
            </span>
          </div>
        ))}
      </div>

      <nav className={s.tabs} aria-label="Audit sections">
        {TABS.map((t) => (
          <Link key={t} href={q({ tab: t })} className={t === active ? s.tabOn : undefined} aria-current={t === active ? 'page' : undefined}>
            {t}
          </Link>
        ))}
      </nav>

      {active === 'Overview' && (
        <>
          <div className={s.overview}>
            <section className={s.card}>
              <h2>
                <FileText size={20} /> Page Overview
              </h2>
              <p>Key information about your page and its current optimization status.</p>
              <dl className={s.kv}>
                {[
                  ['Page Title', audit?.page?.title],
                  ['Meta Description', audit?.page?.metaDescription],
                  ['URL', audit?.page?.url ?? pageUrl],
                  ['H1 Heading', audit?.page?.h1],
                  ['Word Count', audit?.page ? String(audit.page.wordCount) : null],
                  ['Last Analyzed', audit?.completedAt ? formatDateTime(audit.completedAt) : null],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt>{k}</dt>
                    <dd>{v || (audit?.status === 'SUCCEEDED' ? 'Missing' : 'Not analyzed yet')}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className={s.card}>
              <h2>
                <Lightbulb size={20} /> Top Opportunities
              </h2>
              {top.length ? (
                <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
                  {top.map((f) => (
                    <li key={f.id}>
                      <b>{f.title}</b>
                      <br />
                      <small style={{ color: 'var(--muted)' }}>{f.guidance}</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className={s.empty}>
                  <ClipboardList size={36} />
                  <b>{audit?.status === 'SUCCEEDED' ? 'No open issues' : 'No recommendations yet'}</b>
                  <small>{audit?.status === 'SUCCEEDED' ? 'This page passed every check.' : 'Run an audit to get data-driven recommendations for this page.'}</small>
                </div>
              )}
              {top.length > 0 && (
                <Link href={q({ tab: 'Recommendations' })} style={{ display: 'inline-block', marginTop: 10, color: 'var(--blue)' }}>
                  View all {findings.length} recommendations →
                </Link>
              )}
            </section>
            <section className={s.card}>
              <h2>
                <BarChart3 size={20} /> Content Strategy
              </h2>
              <p>Discover content opportunities based on your site and industry.</p>
              <ul className={s.links}>
                {[
                  ['Topic opportunities', 'Find relevant topics based on your niche', '/app/content/ideas', <Target key="t" size={18} />],
                  ['Suggested blog posts', 'Get data-driven content ideas', '/app/content/plan', <FileText key="b" size={18} />],
                  ['Content gaps', 'Identify topics your competitors cover', '/app/keywords/competitors', <BarChart3 key="g" size={18} />],
                  ['Internal linking opportunities', 'Find relevant internal links', '/app/optimize', <Link2 key="l" size={18} />],
                ].map(([t, x, h, i]) => (
                  <li key={t as string}>
                    <Link href={h as string}>
                      {i}
                      <span>
                        <b>{t}</b>
                        <small>{x}</small>
                      </span>
                      <ChevronRight size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className={s.cards}>
            {[
              ['Content Analysis', `${byCategory('CONTENT').length} content finding(s).`, 'Content', <FileText key="c" size={22} />],
              ['Technical Analysis', `${byCategory('TECHNICAL').length} technical finding(s).`, 'Technical', <Settings key="t" size={22} />],
              ['AI Search Analysis', `${byCategory('GEO').length} AI search finding(s).`, 'AI Search (GEO)', <Sparkles key="a" size={22} />],
              ['Content Strategy', 'Get topic ideas, content gaps and publishing recommendations.', 'Content Strategy', <BarChart3 key="s" size={22} />],
            ].map(([t, x, k, i]) => (
              <Link key={t as string} href={q({ tab: k as string })} className={s.card}>
                <span className={s.icon}>{i}</span>
                <span>
                  <b>{t}</b>
                  <small>{audit?.status === 'SUCCEEDED' || k === 'Content Strategy' ? x : 'Run an audit to see results.'}</small>
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        </>
      )}

      {['Recommendations', 'Content', 'Technical', 'AI Search (GEO)'].includes(active) && (
        <section className={s.card}>
          {audit?.status === 'SUCCEEDED' ? (
            <FindingList
              projectId={project.id}
              findings={
                active === 'Recommendations'
                  ? [...findings].sort((a, b) => a.priority - b.priority)
                  : byCategory(active === 'Content' ? 'CONTENT' : active === 'Technical' ? 'TECHNICAL' : 'GEO').concat(active === 'Content' ? byCategory('SEO') : [])
              }
              empty={`No ${active.toLowerCase()} issues found on this page.`}
            />
          ) : (
            <div className={s.empty}>
              <ClipboardList size={36} />
              <b>{active} results appear after an audit</b>
              <small>Run an audit for this page to see {active.toLowerCase()} findings here.</small>
            </div>
          )}
        </section>
      )}

      {active === 'Content Strategy' && (
        <section className={s.card}>
          <h2>Turn findings into content</h2>
          <p>Thin pages and missing question-style answers are the clearest content opportunities from this audit.</p>
          <ul className={s.links}>
            <li>
              <Link href="/app/content/ideas">
                <Target size={18} />
                <span>
                  <b>Generate topic ideas</b>
                  <small>Ideas grounded in your website, keywords and AI search gaps</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            </li>
            <li>
              <Link href="/app/content/briefs">
                <FileText size={18} />
                <span>
                  <b>Create a content brief</b>
                  <small>Outline, questions and keywords for a writer</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            </li>
          </ul>
        </section>
      )}

      {active === 'Competitors' && (
        <section className={s.card}>
          <h2>Competitor comparison</h2>
          <p>Compare against competitors in keyword research and AI search answers.</p>
          <ul className={s.links}>
            <li>
              <Link href="/app/keywords/competitors">
                <BarChart3 size={18} />
                <span>
                  <b>Competitor keywords</b>
                  <small>See what competing domains rank for</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            </li>
            <li>
              <Link href="/app/geo/competitors">
                <Sparkles size={18} />
                <span>
                  <b>AI search competitors</b>
                  <small>Who AI assistants mention instead of you</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            </li>
          </ul>
        </section>
      )}

      {history.ok && history.data.length > 0 && (
        <section className={s.card} style={{ marginTop: 18 }}>
          <h2>
            <History size={20} /> Recent audits
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {history.data.map((r) => (
              <li key={r.id} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', fontSize: 14 }}>
                <Link href={`/app/audit?${new URLSearchParams({ url: r.request?.url ?? '', mode, run: r.id })}`} style={{ color: 'var(--blue)', wordBreak: 'break-all' }}>
                  {r.request?.url ?? 'Audit'}
                </Link>
                <span style={{ color: 'var(--muted)' }}>
                  {r.status === 'SUCCEEDED' ? `Score ${r.scores?.overall ?? '—'}` : r.status.toLowerCase()} · {r.request?.scope === 'SITE' ? `${r.pagesCrawled ?? 0} pages` : 'page'} · {formatDateTime(r.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
