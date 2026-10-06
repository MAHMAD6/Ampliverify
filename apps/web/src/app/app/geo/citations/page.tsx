import { Link2 } from 'lucide-react';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable } from '@/components/app/geo/GeoShell';

export const metadata = { title: 'Citations · AI Search (GEO)' };

/** Citations tab = the page map's Sources & Citations (`geo_sources`, `geo_citations`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period = '30d' } = await searchParams;
  return (
    <GeoShell tab="citations" period={period}>
      <GeoTable columns={['Source', 'Domain', 'Citations', 'Prompts', 'Platforms', 'Last Seen']}>
        <StateView kind="empty" compact icon={<Link2 size={28} />} title="No citations yet" description="Citations appear after your first prompt check finds sources in AI answers." />
      </GeoTable>
    </GeoShell>
  );
}
