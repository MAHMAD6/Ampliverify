import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ContentFilters, EmptyContent } from '@/components/public/ContentList';
import { Hero } from '@/components/public/Hero';
import { apiList, qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ContentSummary } from '@/lib/types';
import s from '@/components/public/public.module.css';

export const metadata: Metadata = { title: 'SEO Guides' };

export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const [guides, categories] = await Promise.all([
    apiList<ContentSummary>(`/public/guides${qs({ q, category })}`),
    apiList<{ name: string; slug: string }>('/public/categories?type=GUIDE'),
  ]);
  return (
    <>
      <Hero eyebrow="Resources" title="SEO Guides">
        Structured, step-by-step guidance for using AmpliVerify and improving SEO workflows with a repeatable engineering mindset.
      </Hero>
      <section className={s.section}>
        <div className={s.container}>
          <ContentFilters action="/guides" q={q} category={category} categories={categories} placeholder="Search guides..." allLabel="All guide types" />
          {guides.length ? (
            <div className={s.guidegrid}>
              {guides.map((g) => (
                <Link key={g.slug} href={`/guides/${g.slug}`} className={s.guidecard}>
                  <div className={s.iconbox}>
                    <BookOpen size={22} />
                  </div>
                  <h3>{g.title}</h3>
                  {g.excerpt && <p>{g.excerpt}</p>}
                  <div className={s.meta}>
                    {g.category?.name ?? 'Guide'} · Updated {formatDate(g.updatedAt ?? g.publishedAt)}
                  </div>
                  <div className={s.read}>Open Guide →</div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyContent filtered={!!(q || category)} title="No guides published yet" text="Step-by-step guides will appear here as they are published." />
          )}
        </div>
      </section>
    </>
  );
}
