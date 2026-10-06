import { PageHeader, TabNav } from '@/components/ui';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { KeywordHeaderActions, KeywordResearch } from './KeywordResearch';
import { BAR_TABS, COLLECTION_TABS, TABS, type TabKey } from './config';

/**
 * One Keyword Research tool. `saved` is the page map's Saved Keywords
 * destination: Keyword Lists filtered to saved keywords
 * (/keywords/lists?saved=true); there is no separate page.
 */
export async function KeywordPage({ tabKey, saved = false }: { tabKey: TabKey; saved?: boolean }) {
  const { selectedProject } = await getAppContext();
  const base = TABS.find((t) => t.key === tabKey)!;
  const tab =
    saved && tabKey === 'lists'
      ? { ...base, tableTitle: 'Saved Keywords', columns: ['Keyword', 'Volume', 'KD', 'List', 'Saved', 'Actions'], emptyTitle: 'No saved keywords yet', emptyText: 'Save keywords from any research tool and they will appear here.' }
      : base;
  return (
    <>
      <PageHeader
        title="Keyword Research"
        description="Find the right keywords to grow your organic traffic. Discover keyword ideas, analyze search intent, check competition, and identify opportunities for your content."
        crumbs={appCrumbs({ label: 'Keyword Research', href: '/app/keywords' }, { label: saved && tabKey === 'lists' ? 'Saved Keywords' : base.label })}
        actions={!COLLECTION_TABS.includes(tab.key) ? <KeywordHeaderActions /> : undefined}
      />
      {BAR_TABS.includes(tab.key) && <TabNav tabs={TABS.filter((t) => BAR_TABS.includes(t.key)).map((t) => ({ key: t.key, label: t.label, href: t.href }))} active={tab.key} />}
      <KeywordResearch key={`${tab.key}:${saved}`} tab={tab} projectId={selectedProject?.id ?? null} />
    </>
  );
}
