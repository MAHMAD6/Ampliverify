import { Target } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Content Strategy' };

export default function Page() {
  return <PendingScreen title="Content Strategy" description="Plan content with ideas, briefs and editorial plans for your projects." icon={<Target size={28} />} emptyText="Content ideas, briefs and plans for the selected project will appear here." />;
}
