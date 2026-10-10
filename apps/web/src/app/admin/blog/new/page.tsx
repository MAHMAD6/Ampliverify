import { redirect } from 'next/navigation';
import { ArticlePage } from '@/components/admin/ArticlePage';

export const metadata = { title: 'Create · Blog Posts' };

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  if ((await searchParams).type === 'guide') redirect('/admin/resources/new');
  return <ArticlePage kind="blog" />;
}
