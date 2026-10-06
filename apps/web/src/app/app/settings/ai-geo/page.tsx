import { Settings } from 'lucide-react';
import { EmptyState } from '@/components/ui';

export const metadata = { title: 'AI & GEO Preferences · Settings' };

export default function Page() {
  return (
    <>
      <h2>AI & GEO Preferences</h2>
      <p>Preferences for AI-assisted suggestions and AI search monitoring.</p>
      <EmptyState icon={<Settings size={26} />} title="No settings to show yet" description="These settings will be available here soon." />
    </>
  );
}
