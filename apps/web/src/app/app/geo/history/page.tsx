import { TrendingUp } from 'lucide-react';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable } from '@/components/app/geo/GeoShell';

export const metadata = { title: 'Visibility Trends · AI Search (GEO)' };

/** Visibility Trends tab = the page map's History (`geo_runs`, `geo_visibility_snapshots`). Empty until the GEO API exists. */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period = '30d' } = await searchParams;
  return (
    <GeoShell tab="trends" period={period}>
      <GeoTable columns={['Check', 'Prompts', 'Platforms', 'Visibility Score', 'Started', 'Status', 'Credits Used']}>
        <StateView kind="empty" compact icon={<TrendingUp size={28} />} title="No visibility history yet" description="Visibility trends appear once prompts have been checked at least twice." />
      </GeoTable>
    </GeoShell>
  );
}
