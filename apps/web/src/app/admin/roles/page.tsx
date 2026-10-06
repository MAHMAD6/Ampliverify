import { KeyRound } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Roles & Permissions' };

export default function Page() {
  return <PendingScreen title="Roles & Permissions" description="System and custom roles with their permission sets." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'User Management' }, { label: 'Roles & Permissions' }]} icon={<KeyRound size={28} />} />;
}
