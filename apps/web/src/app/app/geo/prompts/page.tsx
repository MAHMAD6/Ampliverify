import { MessageSquare } from 'lucide-react';
import { GeoSubPage } from '@/components/app/geo/GeoSubPage';

export const metadata = { title: 'Prompt Tracking · AI Search (GEO)' };

/** Tracked prompts (`geo_prompts`, `geo_prompt_schedules`). */
export default function Page() {
  return (
    <GeoSubPage
      title="Prompt Tracking"
      description="Save the questions your audience asks AI assistants and track how often your brand appears in the answers."
      tableTitle="Tracked Prompts"
      columns={['Prompt', 'Platforms', 'Frequency', 'Last Check', 'Visibility', 'Status', 'Actions']}
      icon={<MessageSquare size={28} />}
      emptyTitle="No tracked prompts yet"
      emptyText="Add the questions your audience asks AI assistants to start monitoring visibility. Each check consumes GEO credits based on the selected platforms."
      action="Add Prompt"
      setup
    />
  );
}
