import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleLayout } from '@/components/public/ArticleLayout';
import { apiGet } from '@/lib/api';
import { formatDate, readingTime } from '@/lib/format';
import type { ContentDetail } from '@/lib/types';
import s from '@/components/public/public.module.css';

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
  const meta = [`Published ${formatDate(post.publishedAt)}`, post.author?.displayName && `By ${post.author.displayName}`, readingTime(post.body)].filter(Boolean).join('  •  ');
  return (
    <ArticleLayout
      category={post.category?.name ?? 'SEO Engineering'}
      title={post.title}
      summary={post.excerpt}
      meta={meta}
      body={post.body}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: post.title }]}
      footer={
        post.tags && post.tags.length > 0 ? (
          <div className={s.tags}>
            {post.tags.map((t) => (
              <span key={t.slug} className={s.chip}>
                {t.name}
              </span>
            ))}
          </div>
        ) : null
      }
    />
  );
}
