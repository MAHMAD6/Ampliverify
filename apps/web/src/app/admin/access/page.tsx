import { ArrowLeftRight } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Access Assignments' };

export default function Page() {
  return <PendingScreen title="Access Assignments" description="Scoped role assignments across organizations, workspaces and projects." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'User Management' }, { label: 'Access Assignments' }]} icon={<ArrowLeftRight size={28} />} />;
}
