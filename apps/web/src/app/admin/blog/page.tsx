import { Newspaper } from 'lucide-react';
import { ContentList } from '@/components/admin/ContentList';
import { apiGet } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';

export const metadata = { title: 'Blog Posts' };

export default async function BlogPostsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  const posts = await apiGet<ContentSummary[]>('/public/blog?limit=50');
  return (
    <ContentList
      title="Blog Posts"
      description="Create, manage, and publish blog posts to share insights, updates, and resources."
      noun="Blog Post"
      createHref="/admin/blog/new"
      icon={<Newspaper size={40} />}
      items={posts.ok ? posts.data : []}
      loaded={posts.ok}
      tab={tab}
      q={q}
      basePath="/admin/blog"
      publicBase="/blog"
      emptyText="Create your first blog post to share your insights, updates, and resources with your audience."
    />
  );
}
