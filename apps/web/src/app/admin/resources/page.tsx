import { LibraryBig } from 'lucide-react';
import { ContentList } from '@/components/admin/ContentList';
import { apiGet } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';

export const metadata = { title: 'Resources' };

/** Resources are guides (`guides` table). */
export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  const guides = await apiGet<ContentSummary[]>('/public/guides?limit=50');
  return (
    <ContentList
      title="Resources"
      description="Manage guides and downloadable resources to educate and support your audience."
      noun="Resource"
      createHref="/admin/blog/new?type=guide"
      icon={<LibraryBig size={40} />}
      items={guides.ok ? guides.data : []}
      loaded={guides.ok}
      tab={tab}
      q={q}
      basePath="/admin/resources"
      publicBase="/guides"
      emptyText="Create your first resource to share guides, templates, checklists, and other helpful materials."
    />
  );
}
