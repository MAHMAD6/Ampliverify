import { ShieldCheck } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Admins' };

export default function Page() {
  return <PendingScreen title="Admins" description="Platform administrators and their access." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'User Management' }, { label: 'Admins' }]} icon={<ShieldCheck size={28} />} />;
}
