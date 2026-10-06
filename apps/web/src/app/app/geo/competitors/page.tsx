import { Swords } from 'lucide-react';
import { GeoSubPage } from '@/components/app/geo/GeoSubPage';

export const metadata = { title: 'Competitors · AI Search (GEO)' };

/** Competitor share of voice in AI answers (`geo_competitors`, `geo_competitor_mentions`). */
export default function Page() {
  return (
    <GeoSubPage
      title="Competitors"
      description="Compare how often competitors are mentioned and cited in AI answers for your tracked prompts."
      tableTitle="Competitor Visibility"
      columns={['Competitor', 'Mentions', 'Share of Voice', 'Citations', 'Platforms', 'Trend']}
      icon={<Swords size={28} />}
      emptyTitle="No competitor data yet"
      emptyText="Add competitors to this project and run prompt checks to compare visibility."
      action="Add Competitor"
    />
  );
}
