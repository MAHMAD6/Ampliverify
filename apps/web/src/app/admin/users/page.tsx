import { Users } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'All Users' };

export default function Page() {
  return <PendingScreen title="All Users" description="Every user account on the platform." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'User Management' }, { label: 'All Users' }]} icon={<Users size={28} />} />;
}
