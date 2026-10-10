import { ArticlePage } from '@/components/admin/ArticlePage';

export const metadata = { title: 'Edit · Help Articles' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArticlePage kind="help" id={id} />;
}
