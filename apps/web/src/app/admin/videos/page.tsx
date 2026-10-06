import { PlayCircle } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Videos' };

export default function Page() {
  return <PendingScreen title="Videos" description="Upload and manage videos for your content library." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'Content Management', href: '/admin/content' }, { label: 'Videos' }]} icon={<PlayCircle size={28} />} />;
}
