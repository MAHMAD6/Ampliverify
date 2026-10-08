import { ListChecks } from 'lucide-react';
import { EmptyState, PageHeader, TabNav } from '@/components/ui';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { KeywordHeaderActions, KeywordResearch } from './KeywordResearch';
import { KeywordClusters, KeywordLists } from './KeywordCollections';
import { BAR_TABS, COLLECTION_TABS, TABS, type TabKey } from './config';

/**
 * One Keyword Research tool. `saved` is the page map's Saved Keywords
 * destination: Keyword Lists filtered to saved keywords
 * (/keywords/lists?saved=true); there is no separate page.
 */
export async function KeywordPage({ tabKey, saved = false, listId }: { tabKey: TabKey; saved?: boolean; listId?: string }) {
  const { selectedProject } = await getAppContext();
  const tab = TABS.find((t) => t.key === tabKey)!;
  const collection = COLLECTION_TABS.includes(tab.key);
  return (
    <>
      <PageHeader
        title="Keyword Research"
        description="Find the right keywords to grow your organic traffic. Discover keyword ideas, analyze search intent, check competition, and identify opportunities for your content."
        crumbs={appCrumbs({ label: 'Keyword Research', href: '/app/keywords' }, { label: saved && tabKey === 'lists' ? 'Saved Keywords' : tab.label })}
        actions={!collection ? <KeywordHeaderActions /> : undefined}
      />
      {BAR_TABS.includes(tab.key) && <TabNav tabs={TABS.filter((t) => BAR_TABS.includes(t.key)).map((t) => ({ key: t.key, label: t.label, href: t.href }))} active={tab.key} />}
      {collection ? (
        selectedProject ? (
          tab.key === 'clusters' ? (
            <KeywordClusters projectId={selectedProject.id} />
          ) : (
            <KeywordLists projectId={selectedProject.id} saved={saved} listId={listId} />
          )
        ) : (
          <EmptyState icon={<ListChecks size={30} />} title="Select a project" description="Keyword lists and clusters are saved per project." />
        )
      ) : (
        <KeywordResearch key={`${tab.key}:${selectedProject?.id ?? ''}`} tab={tab} projectId={selectedProject?.id ?? null} />
      )}
    </>
  );
}
