import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, CircleDollarSign, FilePenLine, Layers, Rocket, Search, SquarePen } from 'lucide-react';
import { EmptyContent } from '@/components/public/ContentList';
import { Button, Input } from '@/components/ui';
import { apiList, qs } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';
import s from '@/components/public/public.module.css';

export const metadata: Metadata = { title: 'Help Center' };

const TOPICS = [
  { icon: <Rocket size={22} />, title: 'Getting Started', text: 'Account setup, first project, first audit, recommendations, editor, and reports.', q: 'getting started' },
  { icon: <SquarePen size={22} />, title: 'SEO Audits', text: 'Run audits, understand results, troubleshoot processing, and review findings.', q: 'audit' },
  { icon: <FilePenLine size={22} />, title: 'SEO Editor', text: 'Page selection, editing workflows, AI-assisted suggestions, and save behavior.', q: 'editor' },
  { icon: <Layers size={22} />, title: 'AI Search (GEO)', text: 'Prompt tracking, visibility, sources, citations, history, and interpretation.', q: 'geo' },
  { icon: <BarChart3 size={22} />, title: 'Reports', text: 'Generate, share, schedule, download, and troubleshoot reports.', q: 'report' },
  { icon: <CircleDollarSign size={22} />, title: 'Billing & Credits', text: 'Plans, subscriptions, invoices, credits, limits, and billing questions.', q: 'billing' },
];

export default async function HelpCenterPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const articles = await apiList<ContentSummary>(`/public/help${qs({ q, category, limit: 20 })}`);
  const searching = !!(q || category);
  return (
    <>
      <section className={s.hero}>
        <div className={s.eyebrow}>Help Center</div>
        <h1>Find answers and product guidance</h1>
        <p>Search AmpliVerify help content, browse common topics, and move from a question to the right product workflow quickly.</p>
        <form className={s.searchhero} action="/help" role="search">
          <Input name="q" defaultValue={q} placeholder="Search the Help Center..." icon={<Search size={18} />} aria-label="Search the Help Center" />
          <Button type="submit" variant="green">
            Search
          </Button>
        </form>
      </section>
      <section className={s.section}>
        <div className={s.container}>
          {!searching && (
            <div className={s.helpgrid}>
              {TOPICS.map((t) => (
                <Link key={t.title} href={`/help?q=${encodeURIComponent(t.q)}`} className={s.guidecard}>
                  <div className={s.iconbox}>{t.icon}</div>
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                  <div className={s.read}>Browse Articles →</div>
                </Link>
              ))}
            </div>
          )}
          <div className={s.topiclist}>
            <div className={s.topicrow}>
              <div>
                <h4>{searching ? `Results${q ? ` for “${q}”` : ''}` : 'Popular help articles'}</h4>
                <p>{articles.length ? `${articles.length} article${articles.length === 1 ? '' : 's'}` : 'Help articles will be listed here.'}</p>
              </div>
              {searching && <Link href="/help">Clear search</Link>}
            </div>
            {articles.map((a) => (
              <Link key={a.slug} href={`/help/${a.slug}`} className={s.topicrow}>
                <div>
                  <h4>{a.title}</h4>
                  {a.excerpt && <p>{a.excerpt}</p>}
                </div>
                <span>Read →</span>
              </Link>
            ))}
          </div>
          {articles.length === 0 && (
            <div style={{ marginTop: 20 }}>
              <EmptyContent filtered={searching} title="No help articles published yet" text="Help articles will appear here as they are published." />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
