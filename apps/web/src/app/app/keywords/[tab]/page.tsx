import { notFound } from 'next/navigation';
import { KeywordPage } from '@/components/app/keywords/KeywordPage';
import { TABS, type TabKey } from '@/components/app/keywords/config';

function find(slug: string) {
  return TABS.find((t) => t.href === `/app/keywords/${slug}`);
}

export async function generateMetadata({ params }: { params: Promise<{ tab: string }> }) {
  const tab = find((await params).tab);
  return { title: tab ? `${tab.label} · Keyword Research` : 'Keyword Research' };
}

export default async function KeywordTabPage({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ saved?: string; list?: string }> }) {
  const tab = find((await params).tab);
  if (!tab) notFound();
  const sp = await searchParams;
  return <KeywordPage tabKey={tab.key as TabKey} saved={sp.saved === 'true'} listId={sp.list} />;
}
