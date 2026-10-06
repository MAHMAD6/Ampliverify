import Link from 'next/link';
import { ArrowRight, BarChart3, ChevronRight, ClipboardList, FileText, Info, Lightbulb, Link2, Search, Settings, Sparkles, Target } from 'lucide-react';
import { Button, PageHeader } from '@/components/ui';
import { ProjectContext } from '@/components/app/ModuleSetup';
import { getAppContext } from '@/lib/project';
import s from '@/components/app/audit.module.css';

export const metadata = { title: 'On-Page SEO Audit' };

const MODES = [
  ['seo', 'Search (SEO)', <Search key="s" size={16} />],
  ['geo', 'AI Search (GEO)', <Sparkles key="g" size={16} />],
  ['both', 'Both', <BarChart3 key="b" size={16} />],
] as const;

const SCORES = [
  { label: 'SEO Score', text: 'Run an audit to see how well this page is optimized for search engines.', tone: '#86d6a4' },
  { label: 'AI Search Visibility', text: 'Run an audit to see how your content appears in AI search results.', tone: '#9ad7ef' },
  { label: 'Content Score', text: 'Run an audit to evaluate content quality, relevance, and coverage.', tone: '#cbb6f2' },
  { label: 'Technical Score', text: 'Run an audit to check technical SEO factors and page performance.', tone: '#f6c983' },
];

const TABS = ['Overview', 'Recommendations', 'Content', 'Technical', 'AI Search (GEO)', 'Content Strategy', 'Competitors'];

/**
 * On-Page SEO Audit (chat design 2026-10-06; states from user-app-batch2a/03).
 * Audits run in the audit service (`audit_runs`, `audit_pages`,
 * `audit_findings`), which is not built yet: the URL and "Analyze for" choice
 * are real form fields, Run Audit is disabled, and every score shows "—".
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ url?: string; mode?: string; tab?: string }> }) {
  const { url, mode = 'seo', tab = 'Overview' } = await searchParams;
  const { selectedProject } = await getAppContext();
  const pageUrl = url ?? (selectedProject?.primaryDomain ? `https://${selectedProject.primaryDomain}` : '');
  const active = TABS.includes(tab) ? tab : 'Overview';
  const q = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(pageUrl && { url: pageUrl }), mode, ...extra })}`;
  return (
    <>
      {selectedProject && <ProjectContext project={selectedProject} />}
      <PageHeader title="On-Page SEO Audit" description="Analyze your page for SEO, AI search visibility, and content. Get actionable recommendations to improve and verify your results." />
      <form className={s.runBar}>
        <input name="url" type="url" defaultValue={pageUrl} placeholder="https://example.com/page" aria-label="Page URL" className={s.url} />
        <input type="hidden" name="mode" value={mode} />
        <Button type="submit" size="lg" disabled title="Audits are not available for your account yet.">
          Run Audit <ArrowRight size={18} />
        </Button>
      </form>
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
      <div className={s.scores}>
        {SCORES.map((sc) => (
          <div key={sc.label} className={s.score}>
            <span className={s.ring} style={{ borderColor: sc.tone }}>
              —
            </span>
            <span>
              <b>{sc.label}</b>
              <em>Not analyzed yet</em>
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
      {active === 'Overview' ? (
        <>
          <div className={s.overview}>
            <section className={s.card}>
              <h2>
                <FileText size={20} /> Page Overview
              </h2>
              <p>Key information about your page and its current optimization status.</p>
              <dl className={s.kv}>
                {['Page Title', 'Meta Description', 'URL', 'H1 Heading', 'Word Count', 'Last Analyzed'].map((k) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{k === 'URL' && pageUrl ? pageUrl : 'Not analyzed yet'}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className={s.card}>
              <h2>
                <Lightbulb size={20} /> Top Opportunities
              </h2>
              <p>Run an audit to see prioritized opportunities based on your analysis.</p>
              <div className={s.empty}>
                <ClipboardList size={36} />
                <b>No recommendations yet</b>
                <small>Run an audit to get data-driven recommendations for this page.</small>
              </div>
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
              ['Content Analysis', 'Analyze your page content for SEO and AI search optimization.', 'Content', <FileText key="c" size={22} />],
              ['Technical Analysis', 'Check technical SEO factors and page performance.', 'Technical', <Settings key="t" size={22} />],
              ['AI Search Analysis', 'Analyze how your page may appear in AI-generated results.', 'AI Search (GEO)', <Sparkles key="a" size={22} />],
              ['Content Strategy', 'Get topic ideas, content gaps and publishing recommendations.', 'Content Strategy', <BarChart3 key="s" size={22} />],
            ].map(([t, x, k, i]) => (
              <Link key={t as string} href={q({ tab: k as string })} className={s.card}>
                <span className={s.icon}>{i}</span>
                <span>
                  <b>{t}</b>
                  <small>{x}</small>
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <section className={s.card}>
          <div className={s.empty}>
            <ClipboardList size={36} />
            <b>{active} results appear after an audit</b>
            <small>Run an audit for this page to see {active.toLowerCase()} findings here.</small>
          </div>
        </section>
      )}
    </>
  );
}
