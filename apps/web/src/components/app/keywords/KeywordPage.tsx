import { PageHeader, TabNav } from '@/components/ui';
import { getAppContext } from '@/lib/project';
import { KeywordHeaderActions, KeywordResearch } from './KeywordResearch';
import { TABS, type TabKey } from './config';

export async function KeywordPage({ tabKey }: { tabKey: TabKey }) {
  const { selectedProject } = await getAppContext();
  const tab = TABS.find((t) => t.key === tabKey)!;
  return (
    <>
      <PageHeader
        title="Keyword Research"
        description="Find the right keywords to grow your organic traffic. Discover keyword ideas, analyze search intent, check competition, and identify opportunities for your content."
        actions={tab.key !== 'lists' ? <KeywordHeaderActions /> : undefined}
      />
      <TabNav tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.href }))} active={tab.key} />
      <KeywordResearch key={tab.key} tab={tab} projectId={selectedProject?.id ?? null} />
    </>
  );
}
