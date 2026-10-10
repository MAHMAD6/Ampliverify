import { LibraryBig } from 'lucide-react';
import { ContentList } from '@/components/admin/ContentList';

export const metadata = { title: 'Resources' };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  return <ContentList kind="guides" description="Manage guides and downloadable resources to educate and support your audience." icon={<LibraryBig size={40} />} emptyText="Create your first resource to share guides, templates, checklists, and other helpful materials." tab={tab} q={q} />;
}
