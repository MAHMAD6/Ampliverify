import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleLayout } from '@/components/public/ArticleLayout';
import { apiGet, apiList } from '@/lib/api';
import { formatDate, readingTime } from '@/lib/format';
import type { ContentDetail, ContentSummary } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const result = await apiGet<ContentDetail>(`/public/guides/${encodeURIComponent(slug)}`);
  if (!result.ok) notFound();
  return result.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = await load((await params).slug);
  return { title: guide.seoTitle ?? guide.title, description: guide.metaDescription ?? guide.excerpt ?? undefined };
}

export default async function GuidePage({ params }: Props) {
  const guide = await load((await params).slug);
  const meta = [`Last updated ${formatDate(guide.updatedAt ?? guide.publishedAt)}`, readingTime(guide.body)].filter(Boolean).join('  •  ');
  return (
    <ArticleLayout
      category={guide.category?.name ?? 'Guide'}
      title={guide.title}
      summary={guide.excerpt}
      meta={meta}
      author={guide.author?.displayName}
      body={guide.body}
      breadcrumb={[{ label: 'Resources', href: '/guides' }, { label: guide.title }]}
      related={(await apiList<ContentSummary>('/public/guides?limit=6')).filter((g) => g.slug !== guide.slug).map((g) => ({ href: `/guides/${g.slug}`, title: g.title, category: g.category?.name }))}
    />
  );
}
