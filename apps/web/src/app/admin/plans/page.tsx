import Link from 'next/link';
import { CalendarDays, CircleDot, CreditCard, Layers, Pause, Plus } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { matchesQ } from '@/lib/admin-data';
import { apiGet } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { PublicPlan } from '@/lib/types';

export const metadata = { title: 'Plans & Pricing' };

/**
 * Plans & Pricing (chat design 2026-10-06). Active public plans are live from
 * `GET /public/plans`; inactive/draft plans need the admin plans API.
 * Included credits come from a `credits` LIMIT entitlement when one exists.
 */
export default async function PlansPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'all', q } = await searchParams;
  const res = await apiGet<PublicPlan[]>('/public/plans');
  const plans = res.ok ? res.data : [];
  const price = (p: PublicPlan, i: 'MONTHLY' | 'ANNUAL') => {
    const x = p.prices.find((y) => y.billingInterval === i);
    return x ? formatMoney(x.amountMinor, x.currency) : '—';
  };
  const credits = (p: PublicPlan) => {
    const e = p.entitlements.find((x) => x.enabled && x.feature.valueType === 'LIMIT' && /credit/i.test(x.feature.key));
    return e?.limitNumeric ? Number(e.limitNumeric).toLocaleString('en-US') : '—';
  };
  const rows = tab === 'inactive' ? [] : plans.filter((p) => matchesQ(q, p.name, p.code));
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
        { label: 'Total Plans', icon: <Layers size={26} />, tone: 'blue', note: 'Needs the admin plans API' },
        { label: 'Active Plans', icon: <CircleDot size={26} />, tone: 'green', value: res.ok ? plans.length : undefined },
        { label: 'Inactive Plans', icon: <Pause size={26} />, tone: 'slate' },
        { label: 'Plans with Annual Billing', icon: <CalendarDays size={26} />, tone: 'purple', value: res.ok ? plans.filter((p) => p.prices.some((x) => x.billingInterval === 'ANNUAL')).length : undefined },
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
      columns={['Plan Name', 'Monthly Price', 'Annual Price', 'Included Credits', 'Feature Access', 'Status', 'Actions']}
      rows={rows.map((p) => [
        <b key="n">{p.name}</b>,
        price(p, 'MONTHLY'),
        price(p, 'ANNUAL'),
        credits(p),
        `${p.entitlements.filter((e) => e.enabled).length} features`,
        <StatusPill key="s" tone="green">
          Active
        </StatusPill>,
        <Link key="v" href={`/admin/plans/${encodeURIComponent(p.code)}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          Edit
        </Link>,
      ])}
      empty={{ icon: <CreditCard size={40} />, title: 'No plans yet', text: 'Create your first subscription plan to start offering access to your platform. You can set pricing, credits, and feature entitlements.', action: create }}
    />
  );
}
