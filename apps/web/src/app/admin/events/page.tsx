import { CalendarDays } from 'lucide-react';
import { PendingScreen } from '@/components/ui/PendingScreen';

export const metadata = { title: 'Webinars & Events' };

export default function Page() {
  return <PendingScreen title="Webinars & Events" description="Create and manage webinars, virtual events, and recordings." crumbs={[{ label: 'Command Center', href: '/admin' }, { label: 'Content Management', href: '/admin/content' }, { label: 'Webinars & Events' }]} icon={<CalendarDays size={28} />} />;
}
