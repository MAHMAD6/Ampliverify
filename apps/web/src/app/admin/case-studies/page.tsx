import { Layers } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Case Studies' };

export default function Page() {
  return <PendingScreen title="Case Studies" description="Showcase customer stories and success examples." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'Content Management', href: '/admin/content' }, { label: 'Case Studies' }]} icon={<Layers size={28} />} />;
}
