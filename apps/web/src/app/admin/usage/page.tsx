import { BarChart3 } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Usage & Costs' };

export default function Page() {
  return <PendingScreen title="Usage & Costs" description="Metered usage and provider costs across workspaces." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'System Operations' }, { label: 'Usage & Costs' }]} icon={<BarChart3 size={28} />} />;
}
