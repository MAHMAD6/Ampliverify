import { Lightbulb } from 'lucide-react';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable } from '@/components/app/geo/GeoShell';

export const metadata = { title: 'Opportunities · AI Search (GEO)' };

/** Visibility opportunities (`geo_opportunities`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period = '30d' } = await searchParams;
  return (
    <GeoShell tab="opportunities" period={period}>
      <GeoTable columns={['Opportunity', 'Platform', 'Prompt', 'Priority', 'Status', 'Action']}>
        <StateView kind="empty" compact icon={<Lightbulb size={28} />} title="No opportunities yet" description="Run prompt checks to discover relevant topics and content gaps that improve visibility." />
      </GeoTable>
    </GeoShell>
  );
}
