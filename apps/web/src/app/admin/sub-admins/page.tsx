import { UserCog } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Sub-Admins' };

export default function Page() {
  return <PendingScreen title="Sub-Admins" description="Restricted administrators and their scopes." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'User Management' }, { label: 'Sub-Admins' }]} icon={<UserCog size={28} />} />;
}
