import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogArticle } from '@/components/public/ArticleDetail';
import { apiGet } from '@/lib/api';
import { webMediaUrl } from '@/lib/media';
import type { ContentDetail } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const result = await apiGet<ContentDetail>(`/public/blog/${encodeURIComponent(slug)}`);
  if (!result.ok) notFound();
  return result.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).slug);
  return {
    title: post.seoTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    openGraph: { type: 'article', title: post.seoTitle ?? post.title, description: post.metaDescription ?? post.excerpt ?? undefined, ...(post.imageUrl ? { images: [webMediaUrl(post.imageUrl)] } : {}) },
  };
}

export default async function BlogPostPage({ params }: Props) {
  return <BlogArticle post={await load((await params).slug)} />;
}
