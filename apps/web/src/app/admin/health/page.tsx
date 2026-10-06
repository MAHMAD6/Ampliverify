import { Activity } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'System Health' };

export default function Page() {
  return <PendingScreen title="System Health" description="Component health checks and incidents." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'System Operations' }, { label: 'System Health' }]} icon={<Activity size={28} />} />;
}
