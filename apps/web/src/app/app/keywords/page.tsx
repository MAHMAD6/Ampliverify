import Link from 'next/link';
import { BookmarkCheck, ChevronRight, Compass, HelpCircle, Layers, ListChecks, Network, Search, Swords } from 'lucide-react';
import { Card, Grid, IconCircle, PageHeader, Panel, type Tone } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';

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

/** Keyword Research overview (`/keywords` in the navigation page map; no screen design supplied). */
export default function KeywordOverviewPage() {
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
      <Panel title="Recent Research">
        <StateView kind="empty" compact icon={<Search size={30} />} title="No keyword research yet" description="Searches you run in any research tool will be listed here." />
      </Panel>
    </>
  );
}
