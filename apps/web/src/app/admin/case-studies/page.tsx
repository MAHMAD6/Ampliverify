import { Layers } from 'lucide-react';
import { ContentList } from '@/components/admin/ContentList';

export const metadata = { title: 'Case Studies' };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  return <ContentList kind="case-studies" description="Showcase customer stories and measured results." icon={<Layers size={40} />} emptyText="Create your first case study to show real customer results." tab={tab} q={q} />;
}
