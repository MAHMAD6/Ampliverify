import { Settings } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Settings' };

export default function Page() {
  return <PendingScreen title="Settings" description="Platform configuration." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'System Operations' }, { label: 'Settings' }]} icon={<Settings size={28} />} />;
}
