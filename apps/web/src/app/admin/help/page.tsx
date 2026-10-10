import { LifeBuoy } from 'lucide-react';
import { ContentList } from '@/components/admin/ContentList';

export const metadata = { title: 'Help Articles' };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  return <ContentList kind="help" description="Manage Help Center articles that answer customer questions." icon={<LifeBuoy size={40} />} emptyText="Create your first help article so customers can find answers on their own." tab={tab} q={q} />;
}
