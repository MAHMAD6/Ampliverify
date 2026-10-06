import { Flag } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Feature Flags' };

export default function Page() {
  return <PendingScreen title="Feature Flags" description="Operational flags and rollout rules per environment." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'System Operations' }, { label: 'Feature Flags' }]} icon={<Flag size={28} />} />;
}
