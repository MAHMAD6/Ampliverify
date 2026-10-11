import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideArticle } from '@/components/public/ArticleDetail';
import { apiGet } from '@/lib/api';
import { webMediaUrl } from '@/lib/media';
import type { ContentDetail } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const result = await apiGet<ContentDetail>(`/public/guides/${encodeURIComponent(slug)}`);
  if (!result.ok) notFound();
  return result.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = await load((await params).slug);
  return {
    title: guide.seoTitle ?? guide.title,
    description: guide.metaDescription ?? guide.excerpt ?? undefined,
    openGraph: { type: 'article', title: guide.seoTitle ?? guide.title, description: guide.metaDescription ?? guide.excerpt ?? undefined, ...(guide.imageUrl ? { images: [webMediaUrl(guide.imageUrl)] } : {}) },
  };
}

export default async function GuidePage({ params }: Props) {
  return <GuideArticle guide={await load((await params).slug)} />;
}
