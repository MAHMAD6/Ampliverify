import { ArticlePage } from '@/components/admin/ArticlePage';

export const metadata = { title: 'Edit · Case Studies' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArticlePage kind="case-studies" id={id} />;
}
