import { Settings } from 'lucide-react';
import { EmptyState } from '@/components/ui';

export const metadata = { title: 'Project Defaults · Settings' };

export default function Page() {
  return (
    <>
      <h2>Project Defaults</h2>
      <p>Default locale, timezone and crawl settings for new projects.</p>
      <EmptyState icon={<Settings size={26} />} title="No settings to show yet" description="These settings will be available here soon." />
    </>
  );
}
