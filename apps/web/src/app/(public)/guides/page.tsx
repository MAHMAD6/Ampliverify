import type { Metadata } from 'next';
import { ArticleIndex } from '@/components/public/ArticleIndex';
import { apiList, qs } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Guides' };

export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const [guides, categories] = await Promise.all([apiList<ContentSummary>(`/public/guides${qs({ q, category })}`), apiList<{ name: string; slug: string }>('/public/categories?type=GUIDE')]);
  return <ArticleIndex basePath="/guides" kind="Guide" items={guides} categories={categories} q={q} category={category} />;
}
