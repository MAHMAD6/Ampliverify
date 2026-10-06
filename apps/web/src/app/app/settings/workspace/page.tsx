import { Settings } from 'lucide-react';
import { EmptyState } from '@/components/ui';

export const metadata = { title: 'Workspace · Settings' };

export default function Page() {
  return (
    <>
      <h2>Workspace</h2>
      <p>Manage workspace name, members and defaults.</p>
      <EmptyState icon={<Settings size={26} />} title="No settings to show yet" description="These settings will be available here soon." />
    </>
  );
}
