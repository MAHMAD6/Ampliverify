import { FileBarChart } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Reports' };

export default function Page() {
  return <PendingScreen title="Reports" description="Generate, schedule and share reports for your projects." icon={<FileBarChart size={28} />} emptyText="Reports you generate or schedule will appear here." />;
}
