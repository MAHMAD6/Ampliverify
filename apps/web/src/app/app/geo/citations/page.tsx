import { Link2 } from 'lucide-react';
import { GeoSubPage } from '@/components/app/geo/GeoSubPage';

export const metadata = { title: 'Sources & Citations · AI Search (GEO)' };

/** Sources cited in AI answers (`geo_sources`, `geo_citations`). */
export default function Page() {
  return (
    <GeoSubPage
      title="Sources & Citations"
      description="See which pages and domains AI assistants cite when answering your tracked prompts."
      tableTitle="Cited Sources"
      columns={['Source', 'Domain', 'Citations', 'Prompts', 'Platforms', 'Last Seen']}
      icon={<Link2 size={28} />}
      emptyTitle="No citations yet"
      emptyText="Citations appear after your first prompt check finds sources in AI answers."
    />
  );
}
