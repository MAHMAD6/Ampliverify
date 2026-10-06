import type { Metadata } from 'next';
import { ArticleIndex } from '@/components/public/ArticleIndex';
import { apiList, qs } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const [posts, categories] = await Promise.all([apiList<ContentSummary>(`/public/blog${qs({ q, category })}`), apiList<{ name: string; slug: string }>('/public/categories?type=BLOG')]);
  return <ArticleIndex basePath="/blog" kind="Article" items={posts} categories={categories} q={q} category={category} />;
}
