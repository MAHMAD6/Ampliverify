import { History } from 'lucide-react';
import { GeoSubPage } from '@/components/app/geo/GeoSubPage';

export const metadata = { title: 'History · AI Search (GEO)' };

/** Past prompt checks (`geo_runs`, `geo_platform_results`). */
export default function Page() {
  return (
    <GeoSubPage
      title="History"
      description="Every prompt check that has run for this project, with its results and credit usage."
      tableTitle="Check History"
      columns={['Run', 'Prompts', 'Platforms', 'Started', 'Status', 'Credits Used']}
      icon={<History size={28} />}
      emptyTitle="No checks have run yet"
      emptyText="Checks appear here once tracked prompts are monitored."
    />
  );
}
