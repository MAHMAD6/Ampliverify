import { notFound } from 'next/navigation';
import { KeywordPage } from '@/components/app/keywords/KeywordPage';
import { TABS, type TabKey } from '@/components/app/keywords/config';

const SUB_TABS = TABS.filter((t) => t.key !== 'explorer');

export async function generateMetadata({ params }: { params: Promise<{ tab: string }> }) {
  const slug = (await params).tab;
  const tab = SUB_TABS.find((t) => t.href.endsWith(`/${slug}`));
  return { title: tab ? `${tab.label} · Keyword Research` : 'Keyword Research' };
}

export default async function KeywordTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const slug = (await params).tab;
  const tab = SUB_TABS.find((t) => t.href.endsWith(`/${slug}`));
  if (!tab) notFound();
  return <KeywordPage tabKey={tab.key as TabKey} />;
}
