import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleLayout } from '@/components/public/ArticleLayout';
import { apiGet, apiList } from '@/lib/api';
import { formatDate, readingTime } from '@/lib/format';
import type { ContentDetail, ContentSummary } from '@/lib/types';
import s from '@/components/public/site.module.css';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const result = await apiGet<ContentDetail>(`/public/blog/${encodeURIComponent(slug)}`);
  if (!result.ok) notFound();
  return result.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).slug);
  return { title: post.seoTitle ?? post.title, description: post.metaDescription ?? post.excerpt ?? undefined };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await load((await params).slug);
  const others = (await apiList<ContentSummary>('/public/blog?limit=12')).filter((p) => p.slug !== post.slug);
  const sameTopic = others.filter((p) => p.category?.slug && p.category.slug === post.category?.slug);
  const related = [...sameTopic, ...others.filter((p) => !sameTopic.includes(p))].map((p) => ({ href: `/blog/${p.slug}`, title: p.title, category: p.category?.name }));
  return (
    <ArticleLayout
      category={post.category?.name ?? 'Article'}
      title={post.title}
      summary={post.excerpt}
      author={post.author?.displayName}
      meta={[formatDate(post.publishedAt), readingTime(post.body)].filter(Boolean).join(' · ')}
      body={post.body}
      breadcrumb={[{ label: 'Resources', href: '/blog' }, { label: post.title }]}
      related={related}
      footer={
        post.tags && post.tags.length > 0 ? (
          <div className={s.pills} style={{ marginTop: 24 }}>
            {post.tags.map((t) => (
              <span key={t.slug}>#{t.name}</span>
            ))}
          </div>
        ) : null
      }
    />
  );
}
