'use client';

import { usePathname } from 'next/navigation';
import { TabNav } from '@/components/ui';

const TABS = [
  { key: 'overview', label: 'Overview', href: '/seller/payouts' },
  { key: 'earnings', label: 'Earnings Breakdown', href: '/seller/payouts/earnings' },
  { key: 'history', label: 'Payout History', href: '/seller/payouts/history' },
  { key: 'method', label: 'Payout Method', href: '/seller/payouts/method' },
  { key: 'statements', label: 'Tax & Statements', href: '/seller/payouts/statements' },
  { key: 'disputes', label: 'Refunds & Disputes', href: '/seller/payouts/disputes' },
];

export function PayoutTabs() {
  const pathname = usePathname();
  const sub = TABS.slice(1).find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
  // Payout detail pages (/seller/payouts/<id>) belong to Payout History.
  const active = pathname === '/seller/payouts' ? 'overview' : (sub?.key ?? 'history');
  return <TabNav tabs={TABS} active={active} />;
}
