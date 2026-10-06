import { FileText } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Admin Activity' };

export default function Page() {
  return <PendingScreen title="Admin Activity" description="Readable history of administrative actions." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'System Operations' }, { label: 'Admin Activity' }]} icon={<FileText size={28} />} />;
}
