import { ToggleLeft } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Module Controls' };

export default function Page() {
  return <PendingScreen title="Module Controls" description="Enable or disable product modules platform-wide." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'System Operations' }, { label: 'Module Controls' }]} icon={<ToggleLeft size={28} />} />;
}
