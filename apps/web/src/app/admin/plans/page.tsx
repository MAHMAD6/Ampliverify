import Link from 'next/link';
import { CalendarDays, CircleDot, CreditCard, Layers, Pause, Plus } from 'lucide-react';
import { Badge, ButtonLink } from '@/components/ui';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, matchesQ, type AdminPlan } from '@/lib/admin-data';
import { formatMoney } from '@/lib/format';

export const metadata = { title: 'Plans & Pricing' };

const TONE = { ACTIVE: 'green', DRAFT: 'amber', ARCHIVED: 'slate' } as const;

/** Plans & Pricing (chat design 2026-10-06), from the admin plans API (drafts and archived plans included). */
export default async function PlansPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'all', q } = await searchParams;
  const plans = await adminGet<AdminPlan[]>('/admin/plans');
  const list = plans ?? [];
  const price = (p: AdminPlan, i: 'MONTHLY' | 'ANNUAL') => {
    const x = p.prices.find((y) => y.billingInterval === i && y.active);
    return x ? formatMoney(x.amountMinor, x.currency) : '—';
  };
  const credits = (p: AdminPlan) => {
    const e = p.entitlements.find((x) => x.enabled && x.feature.valueType === 'LIMIT' && /credit/i.test(x.feature.key));
    return e ? (e.limitNumeric ? Number(e.limitNumeric).toLocaleString('en-US') : 'Unlimited') : '—';
  };
  const rows = list.filter((p) => (tab === 'active' ? p.status === 'ACTIVE' : tab === 'inactive' ? p.status !== 'ACTIVE' : true) && matchesQ(q, p.name, p.code));
  const create = (
    <ButtonLink href="/admin/plans/new" icon={<Plus size={18} />}>
      Create Plan
    </ButtonLink>
  );
  return (
    <AdminList
      section="Billing & Access"
      title="Plans & Pricing"
      description="Manage subscription plans, pricing, credits, and feature access."
      actions={create}
      metrics={[
        { label: 'Total Plans', icon: <Layers size={26} />, tone: 'blue', value: plans ? list.length : undefined },
        { label: 'Active Plans', icon: <CircleDot size={26} />, tone: 'green', value: plans ? list.filter((p) => p.status === 'ACTIVE').length : undefined },
        { label: 'Inactive Plans', icon: <Pause size={26} />, tone: 'slate', value: plans ? list.filter((p) => p.status !== 'ACTIVE').length : undefined },
        { label: 'Plans with Annual Billing', icon: <CalendarDays size={26} />, tone: 'purple', value: plans ? list.filter((p) => p.prices.some((x) => x.billingInterval === 'ANNUAL' && x.active)).length : undefined },
      ]}
      tabs={[
        { key: 'all', label: 'All Plans' },
        { key: 'active', label: 'Active' },
        { key: 'inactive', label: 'Inactive' },
      ]}
      activeTab={tab}
      basePath="/admin/plans"
      search="Search plans..."
      liveFilters={{ q }}
      columns={['Plan Name', 'Monthly Price', 'Annual Price', 'Included Credits', 'Feature Access', 'Subscribers', 'Status', 'Actions']}
      rows={rows.map((p) => [
        <span key="n">
          <b>{p.name}</b> {p.isFeatured && <Badge tone="blue">Most Popular</Badge>}
          <small style={{ display: 'block', color: 'var(--muted)' }}>
            {p.code}
            {p.isPublic ? ' · public' : ' · hidden'}
          </small>
        </span>,
        price(p, 'MONTHLY'),
        price(p, 'ANNUAL'),
        credits(p),
        `${p.entitlements.filter((e) => e.enabled).length} features`,
        p._count.subscriptions,
        <StatusPill key="s" tone={TONE[p.status]}>
          {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
        </StatusPill>,
        <Link key="v" href={`/admin/plans/${encodeURIComponent(p.code)}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          Edit
        </Link>,
      ])}
      empty={{ icon: <CreditCard size={40} />, title: plans ? 'No plans yet' : 'Plans unavailable', text: plans ? 'Create your first subscription plan to start offering access to your platform. You can set pricing, credits, and feature entitlements.' : 'Your account cannot read plans, or the API is unavailable.', action: create }}
    />
  );
}
