import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleLayout } from '@/components/public/ArticleLayout';
import { apiGet } from '@/lib/api';
import { formatDate, readingTime } from '@/lib/format';
import type { ContentDetail } from '@/lib/types';

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
      body={guide.body}
      tocTitle="Guide sections"
      breadcrumb={[{ label: 'Guides', href: '/guides' }, { label: guide.title }]}
    />
  );
}
