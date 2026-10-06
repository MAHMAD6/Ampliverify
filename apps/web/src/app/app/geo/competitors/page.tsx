import { Users } from 'lucide-react';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable } from '@/components/app/geo/GeoShell';

export const metadata = { title: 'Competitors · AI Search (GEO)' };

/** Competitor visibility in AI answers (`geo_competitors`, `geo_competitor_mentions`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period = '30d' } = await searchParams;
  return (
    <GeoShell tab="competitors" period={period}>
      <GeoTable columns={['Competitor', 'Mentions', 'Share of Voice', 'Citations', 'Platforms', 'Trend']}>
        <StateView kind="empty" compact icon={<Users size={28} />} title="No competitor data yet" description="Add competitors to this project and run prompt checks to compare visibility." />
      </GeoTable>
    </GeoShell>
  );
}
