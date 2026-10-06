import { Search } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Search' };

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  return (
    <PendingScreen
      title="Search"
      description={q ? `Results for “${q}”` : 'Search users, content, billing, settings, or pages.'}
      icon={<Search size={28} />}
      emptyTitle={q ? 'No results' : 'Enter a search term'}
      emptyText="Admin search covers users, content and billing records as those areas come online."
    />
  );
}
