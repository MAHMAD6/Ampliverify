import { Shield } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Security & Access' };

export default function Page() {
  return <PendingScreen title="Security & Access" description="Security settings and authentication events." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'System Operations' }, { label: 'Security & Access' }]} icon={<Shield size={28} />} />;
}
