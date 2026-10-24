import Link from 'next/link';
import { BookmarkCheck, ChevronRight, Compass, HelpCircle, Layers, ListChecks, Network, Search, Swords } from 'lucide-react';
import { Card, Grid, IconCircle, PageHeader, Panel, type Tone } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Keyword Research' };

const TOOLS: { title: string; text: string; href: string; icon: React.ReactNode; tone: Tone }[] = [
  { title: 'Keyword Explorer', text: 'Discover keyword ideas with volume, difficulty, CPC and intent.', href: '/app/keywords/explorer', icon: <Search size={22} />, tone: 'blue' },
  { title: 'Related Keywords', text: 'Expand a topic with semantically related terms.', href: '/app/keywords/related', icon: <Network size={22} />, tone: 'purple' },
  { title: 'Questions', text: 'Find the questions your audience is asking.', href: '/app/keywords/questions', icon: <HelpCircle size={22} />, tone: 'green' },
  { title: 'Competitor Keywords', text: 'See which keywords a competitor ranks for.', href: '/app/keywords/competitors', icon: <Swords size={22} />, tone: 'amber' },
  { title: 'SERP Analysis', text: 'Analyze the top results and SERP features for a keyword.', href: '/app/keywords/serp', icon: <Compass size={22} />, tone: 'blue' },
  { title: 'Keyword Lists', text: 'Organize saved keywords into reusable lists.', href: '/app/keywords/lists', icon: <ListChecks size={22} />, tone: 'green' },
  { title: 'Keyword Clusters', text: 'Group related keywords by topic for content planning.', href: '/app/keywords/clusters', icon: <Layers size={22} />, tone: 'purple' },
  { title: 'Saved Keywords', text: 'Every keyword you have saved, across lists.', href: '/app/keywords/lists?saved=true', icon: <BookmarkCheck size={22} />, tone: 'slate' },
];

/** Keyword Research overview: tools and the project's recent research. */
type Recent = { id: string; query: string; tool: string; countryCode: string; locale: string; resultCount: number | null; createdAt: string };
const TOOL_HREF: Record<string, string> = { EXPLORER: 'explorer', RELATED: 'related', QUESTIONS: 'questions', COMPETITOR: 'competitors', SERP: 'serp' };

export default async function KeywordOverviewPage() {
  const { selectedProject } = await getAppContext();
  const recent = selectedProject ? await apiGet<Recent[]>(`/user/projects/${selectedProject.id}/keywords/research`, { auth: true }) : null;
  const rows = recent?.ok ? recent.data : [];
  type Perf = { connected: boolean; configured?: boolean; error?: string; source?: string; note?: string; syncedAt?: string; startDate?: string; endDate?: string; siteUrl?: string; rows: { key: string; clicks: number; impressions: number; ctr: number; position: number | null }[] };
  const perf = selectedProject ? await apiGet<Perf>(`/user/projects/${selectedProject.id}/search-performance?dimension=query&days=28`, { auth: true }) : null;
  const gsc = perf?.ok ? perf.data : null;
  return (
    <>
      <PageHeader title="Keyword Research" description="Research keywords, analyze search intent and competition, and manage the keywords you save for your projects." />
      <Grid cols={4} style={{ marginBottom: 16 }}>
        {TOOLS.map((t) => (
          <Link key={t.title} href={t.href} style={{ display: 'block' }}>
            <Card style={{ display: 'flex', gap: 14, alignItems: 'flex-start', height: '100%' }}>
              <IconCircle tone={t.tone} size={46}>
                {t.icon}
              </IconCircle>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--heading)', fontSize: 15 }}>{t.title}</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{t.text}</p>
              </div>
              <ChevronRight size={18} color="var(--muted)" />
            </Card>
          </Link>
        ))}
      </Grid>
      <Panel title="Your Search Console Queries" description={gsc?.connected && gsc.configured ? `Queries that already bring impressions to ${gsc.siteUrl}, ${gsc.startDate} – ${gsc.endDate}.` : 'Authorized Search Console data for this project.'}>
        {!gsc?.connected || !gsc.configured ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
            Connect Google Search Console and choose this project’s property in <Link href="/app/settings/integrations" style={{ color: 'var(--blue)' }}>Settings → Integrations</Link> to see the queries you already rank for.
          </p>
        ) : gsc.error ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--amber)' }}>{gsc.error}</p>
        ) : gsc.rows.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>No data available for this period.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Query', 'Clicks', 'Impressions', 'CTR', 'Position'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gsc.rows.slice(0, 20).map((r) => (
                  <tr key={r.key}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>
                      <Link href={`/app/keywords/explorer?q=${encodeURIComponent(r.key)}`} style={{ color: 'var(--blue)' }}>
                        {r.key}
                      </Link>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>{r.clicks.toLocaleString('en-US')}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>{r.impressions.toLocaleString('en-US')}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>{r.ctr}%</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>{r.position ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {gsc?.source && (
          <small style={{ display: 'block', marginTop: 8, color: 'var(--muted)' }}>
            Source: {gsc.source}
            {gsc.syncedAt ? ` · last sync ${formatDateTime(gsc.syncedAt)}` : ''}. {gsc.note}
          </small>
        )}
      </Panel>
      <div style={{ height: 16 }} />
      <Panel title="Recent Research">
        {rows.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {rows.slice(0, 15).map((r) => (
              <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
                <Link href={`/app/keywords/${TOOL_HREF[r.tool] ?? 'explorer'}`} style={{ color: 'var(--blue)' }}>
                  {r.query}
                </Link>
                <span style={{ color: 'var(--muted)' }}>
                  {r.tool.toLowerCase()} · {r.locale}-{r.countryCode} · {r.resultCount ?? 0} results · {formatDateTime(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <StateView kind="empty" compact icon={<Search size={30} />} title="No keyword research yet" description="Searches you run in any research tool will be listed here." />
        )}
      </Panel>
    </>
  );
}
