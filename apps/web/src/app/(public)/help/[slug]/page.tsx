import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleLayout } from '@/components/public/ArticleLayout';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ContentDetail } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const result = await apiGet<ContentDetail>(`/public/help/${encodeURIComponent(slug)}`);
  if (!result.ok) notFound();
  return result.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await load((await params).slug);
  return { title: article.seoTitle ?? article.title, description: article.metaDescription ?? article.excerpt ?? undefined };
}

export default async function HelpArticlePage({ params }: Props) {
  const article = await load((await params).slug);
  return (
    <ArticleLayout
      align="left"
      category={article.category?.name ?? 'Help Article'}
      title={article.title}
      summary={article.excerpt}
      meta={`Last updated ${formatDate(article.updatedAt ?? article.publishedAt)}`}
      body={article.body}
      breadcrumb={[
        { label: 'Help Center', href: '/help' },
        ...(article.category ? [{ label: article.category.name, href: `/help?category=${article.category.slug}` }] : []),
        { label: article.title },
      ]}
    />
  );
}
