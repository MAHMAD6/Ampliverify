import { Tags } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Categories & Tags' };

export default function Page() {
  return <PendingScreen title="Categories & Tags" description="Organize content with categories and tags." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'Content Management', href: '/admin/content' }, { label: 'Categories & Tags' }]} icon={<Tags size={28} />} />;
}
