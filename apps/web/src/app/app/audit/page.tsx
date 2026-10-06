import { SquarePen } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'On-Page SEO Audit' };

export default function Page() {
  return <PendingScreen title="On-Page SEO Audit" description="Run audits on your pages and review findings, scores and recommendations." icon={<SquarePen size={28} />} emptyText="Select a project and run your first audit to see findings here." />;
}
