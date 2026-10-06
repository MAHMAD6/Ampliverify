import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import { ContentFilters, EmptyContent, ResourceGrid } from '@/components/public/ContentList';
import { Hero } from '@/components/public/Hero';
import { apiList, qs } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';
import s from '@/components/public/public.module.css';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const [posts, categories] = await Promise.all([
    apiList<ContentSummary>(`/public/blog${qs({ q, category })}`),
    apiList<{ name: string; slug: string }>('/public/categories?type=BLOG'),
  ]);
  return (
    <>
      <Hero eyebrow="Resources" title="AmpliVerify Blog">
        Practical SEO engineering insights, product guidance, and educational content to help you audit, optimize, and verify more effectively.
      </Hero>
      <section className={s.section}>
        <div className={s.container}>
          <ContentFilters action="/blog" q={q} category={category} categories={categories} placeholder="Search blog articles..." allLabel="All topics" />
          {posts.length ? (
            <ResourceGrid items={posts} basePath="/blog" cta="Read Article" icon={<Newspaper size={36} />} />
          ) : (
            <EmptyContent filtered={!!(q || category)} title="No articles published yet" text="New articles will appear here as they are published." />
          )}
        </div>
      </section>
    </>
  );
}
