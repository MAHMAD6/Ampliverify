import { Newspaper } from 'lucide-react';
import { ContentList } from '@/components/admin/ContentList';

export const metadata = { title: 'Blog Posts' };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  return <ContentList kind="blog" description="Create, manage, and publish blog posts to share insights, updates, and resources." icon={<Newspaper size={40} />} emptyText="Create your first blog post to share your insights, updates, and resources with your audience." tab={tab} q={q} />;
}
