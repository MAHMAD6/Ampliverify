import { CalendarX2, CheckCircle2, Clock3, Hourglass, Users, XCircle, FileSearch } from 'lucide-react';
import { AdminList } from '@/components/admin/AdminList';

export const metadata = { title: 'Subscriptions' };

/** Subscriptions (chat design 2026-10-06). Provider-synchronized `subscriptions`; the admin billing API is not built, so counts read "—" (never a guessed 0). */
export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'all' } = await searchParams;
  return (
    <AdminList
      section="Billing & Access"
      title="Subscriptions"
      description="View and manage all AmpliVerify subscriptions."
      metrics={[
        { label: 'Total Subscriptions', icon: <Users size={24} />, tone: 'blue' },
        { label: 'Active', icon: <CheckCircle2 size={24} />, tone: 'green' },
        { label: 'Trial', icon: <Clock3 size={24} />, tone: 'amber' },
        { label: 'Pending', icon: <Hourglass size={24} />, tone: 'slate' },
        { label: 'Canceled', icon: <XCircle size={24} />, tone: 'red' },
        { label: 'Expired', icon: <CalendarX2 size={24} />, tone: 'slate' },
      ]}
      tabs={['all', 'active', 'trial', 'pending', 'canceled', 'expired'].map((k) => ({ key: k, label: k === 'all' ? 'All Subscriptions' : k.charAt(0).toUpperCase() + k.slice(1) }))}
      activeTab={tab}
      basePath="/admin/subscriptions"
      search="Search by user, account, or email..."
      selects={[
        { label: 'Plan', options: ['All Plans'] },
        { label: 'Status', options: ['All Statuses'] },
        { label: 'Billing Interval', options: ['All Intervals'] },
      ]}
      columns={['Subscriber / Account', 'Plan', 'Billing Interval', 'Status', 'Start Date', 'Renewal / End Date', 'Actions']}
      empty={{ icon: <FileSearch size={40} />, title: 'No subscriptions yet', text: 'When users subscribe to a plan, their subscriptions will appear here.' }}
    />
  );
}
