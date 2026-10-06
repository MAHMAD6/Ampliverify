import { Gauge } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Usage & Credits' };

export default function Page() {
  return <PendingScreen title="Usage & Credits" description="Track credit usage across audits, keyword research and AI search checks." icon={<Gauge size={28} />} emptyText="Credit usage for your workspace will appear here as you use metered features." />;
}
