import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock3, FileSearch, Hourglass, Users, XCircle } from 'lucide-react';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, matchesQ, SUB_TONE } from '@/lib/admin-data';
import { formatDate, formatMoney } from '@/lib/format';

export const metadata = { title: 'Subscriptions' };

type AdminSubscription = {
  id: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
  providerSubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  plan: { code: string; name: string };
  workspace: { id: string; name: string; organization: { name: string } };
  items: { planPrice: { billingInterval: 'MONTHLY' | 'ANNUAL'; amountMinor: string; currency: string } }[];
};

const TABS: Record<string, string[] | null> = { all: null, active: ['ACTIVE'], trial: ['TRIALING'], 'past-due': ['PAST_DUE'], pending: ['INCOMPLETE'], canceled: ['CANCELED'] };

/** Subscriptions (chat design 2026-10-06), synchronized from the billing provider by webhooks. */
export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; plan?: string; interval?: string }> }) {
  const { tab = 'all', q, plan, interval } = await searchParams;
  const subs = await adminGet<AdminSubscription[]>('/admin/subscriptions');
  const list = subs ?? [];
  const count = (s: string) => (subs ? list.filter((x) => x.status === s).length : undefined);
  const plans = [...new Map(list.map((s) => [s.plan.code, s.plan.name])).entries()];
  const rows = list.filter(
    (s) =>
      (!TABS[tab] || TABS[tab]!.includes(s.status)) &&
      (!plan || s.plan.code === plan) &&
      (!interval || s.items.some((i) => i.planPrice.billingInterval === interval)) &&
      matchesQ(q, s.workspace.name, s.workspace.organization.name, s.plan.name, s.providerSubscriptionId),
  );
  return (
    <AdminList
      section="Billing & Access"
      title="Subscriptions"
      description="View and manage all AmpliVerify subscriptions."
      metrics={[
        { label: 'Total Subscriptions', icon: <Users size={24} />, tone: 'blue', value: subs ? list.length : undefined },
        { label: 'Active', icon: <CheckCircle2 size={24} />, tone: 'green', value: count('ACTIVE') },
        { label: 'Trial', icon: <Clock3 size={24} />, tone: 'amber', value: count('TRIALING') },
        { label: 'Past Due', icon: <AlertCircle size={24} />, tone: 'red', value: count('PAST_DUE') },
        { label: 'Pending', icon: <Hourglass size={24} />, tone: 'slate', value: count('INCOMPLETE') },
        { label: 'Canceled', icon: <XCircle size={24} />, tone: 'slate', value: count('CANCELED') },
      ]}
      tabs={Object.keys(TABS).map((k) => ({ key: k, label: k === 'all' ? 'All Subscriptions' : k === 'past-due' ? 'Past Due' : k.charAt(0).toUpperCase() + k.slice(1) }))}
      activeTab={tab}
      basePath="/admin/subscriptions"
      search="Search by workspace, organization, plan or Stripe ID..."
      liveFilters={{ q }}
      selects={[
        { label: 'Plan', name: 'plan', value: plan, options: ['All Plans', ...plans.map(([c, n]) => [c, n] as [string, string])] },
        { label: 'Billing Interval', name: 'interval', value: interval, options: ['All Intervals', ['MONTHLY', 'Monthly'], ['ANNUAL', 'Annual']] },
      ]}
      columns={['Workspace / Account', 'Plan', 'Billing', 'Status', 'Started', 'Renews / Ends', 'Actions']}
      rows={rows.map((s) => {
        const price = s.items[0]?.planPrice;
        return [
          <span key="w">
            <b>{s.workspace.name}</b>
            <small style={{ display: 'block', color: 'var(--muted)' }}>{s.workspace.organization.name}</small>
          </span>,
          s.plan.name,
          price ? `${formatMoney(price.amountMinor, price.currency)} / ${price.billingInterval === 'MONTHLY' ? 'month' : 'year'}` : '—',
          <StatusPill key="s" tone={SUB_TONE[s.status]}>
            {s.status === 'PAST_DUE' ? 'Past due' : s.status.charAt(0) + s.status.slice(1).toLowerCase()}
            {s.cancelAtPeriodEnd && s.status !== 'CANCELED' ? ' · cancels' : ''}
          </StatusPill>,
          formatDate(s.createdAt),
          s.canceledAt ? `Ended ${formatDate(s.canceledAt)}` : formatDate(s.currentPeriodEnd),
          <Link key="v" href={`/admin/subscriptions/${s.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
            View
          </Link>,
        ];
      })}
      empty={{ icon: <FileSearch size={40} />, title: subs ? 'No subscriptions yet' : 'Subscriptions unavailable', text: subs ? 'When users subscribe to a plan, their subscriptions will appear here.' : 'Your account cannot read billing data, or the API is unavailable.' }}
    />
  );
}
