import { UserPen } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Authors' };

export default function Page() {
  return <PendingScreen title="Authors" description="Manage author profiles and contributions." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'Content Management', href: '/admin/content' }, { label: 'Authors' }]} icon={<UserPen size={28} />} />;
}
