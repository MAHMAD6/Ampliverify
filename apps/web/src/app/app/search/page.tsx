import { Search } from 'lucide-react';
import { EmptyState, PageHeader, Panel } from '@/components/ui';
import { getAppContext } from '@/lib/project';
import Link from 'next/link';

export const metadata = { title: 'Search' };

/** Searches what the user can already see: their projects. Other result types join as their APIs land. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  const { projects } = await getAppContext();
  const matches = q ? projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <>
      <PageHeader title="Search" description={q ? `Results for “${q}”` : 'Search your projects, keywords, or help.'} />
      <Panel title="Projects" bodyless>
        {matches.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: '8px 20px' }}>
            {matches.map((p) => (
              <li key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <Link href={`/app/projects/${p.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Search size={26} />} title={q ? 'No matching projects' : 'Enter a search term'} description={q ? 'Try a different term, or search the Help Center.' : 'Use the search box in the top bar.'} />
        )}
      </Panel>
    </>
  );
}
