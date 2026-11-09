import Link from 'next/link';
import { AlertTriangle, ArrowRightLeft, Banknote, ClipboardCheck, Store, Users } from 'lucide-react';
import { DataTable, Grid, Metric, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { AdminMarketNav } from '@/components/admin/market/AdminMarketNav';
import { StatusBadge } from '@/components/market/parts';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { CHECK_KIND, CHECK_STATUS, kindLabel, money, ORDER_STATUS, PAYOUT_STATUS } from '@/lib/marketplace';

export const metadata = { title: 'Marketplace Overview · Admin' };

type Overview = {
  totals: { sellers: number; activeListings: number; pendingReview: number; completedTransactions: number; payoutsProcessed: number; payoutsMinor: number; openCases: number };
  recentChecks: { id: string; kind: string; seller: string; status: string; createdAt: string }[];
  recentListings: { id: string; title: string; kind: string; category: string | null; seller: string; submittedAt: string | null }[];
  recentOrders: { id: string; listing: string; buyer: string | null; seller: string | null; amountMinor: number; currency: string; status: string; createdAt: string }[];
  recentPayouts: { id: string; seller: string; amountMinor: number; currency: string; status: string; createdAt: string }[];
};

/** Marketplace Overview (V2 guide §1): live totals and the work waiting for staff. */
export default async function AdminMarketplaceOverview() {
  const o = await adminGet<Overview>('/admin/marketplace/overview');
  return (
    <>
      <PageHeader title="Marketplace Overview" description="Sellers, listings, transactions and payouts across the Marketplace." />
      <AdminMarketNav active="overview" />
      {!o ? (
        <Panel>
          <StateView kind="error" title="The Marketplace overview could not be loaded with your permissions." />
        </Panel>
      ) : (
        <>
          <Grid cols={4}>
            <Metric label="Sellers" value={o.totals.sellers} icon={<Users size={22} />} tone="blue" />
            <Metric label="Active listings" value={o.totals.activeListings} icon={<Store size={22} />} tone="green" />
            <Metric label="Waiting for review" value={o.totals.pendingReview} note="Listings and seller checks" icon={<ClipboardCheck size={22} />} tone="amber" />
            <Metric label="Open cases" value={o.totals.openCases} note="Refunds and disputes" icon={<AlertTriangle size={22} />} tone={o.totals.openCases ? 'red' : 'slate'} />
            <Metric label="Completed transactions" value={o.totals.completedTransactions} icon={<ArrowRightLeft size={22} />} tone="purple" />
            <Metric label="Payouts processed" value={o.totals.payoutsProcessed} note={money(o.totals.payoutsMinor, 'USD')} icon={<Banknote size={22} />} tone="green" />
          </Grid>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginTop: 16 }}>
            <Panel title="Listings waiting for review" actions={<Link href="/admin/marketplace/listings">Review</Link>} bodyless>
              <DataTable columns={['Listing', 'Type', 'Seller', 'Submitted']} rows={o.recentListings.map((l) => [l.title, kindLabel(l.kind), l.seller, formatDateTime(l.submittedAt)])} empty="No listings are waiting." />
            </Panel>
            <Panel title="Seller checks waiting" actions={<Link href="/admin/marketplace/verification">Review</Link>} bodyless>
              <DataTable columns={['Check', 'Seller', 'Status', 'Submitted']} rows={o.recentChecks.map((c) => [CHECK_KIND[c.kind] ?? c.kind, c.seller, <StatusBadge key="s" map={CHECK_STATUS} value={c.status} />, formatDateTime(c.createdAt)])} empty="No checks are waiting." />
            </Panel>
            <Panel title="Recent orders" actions={<Link href="/admin/marketplace/transactions">All transactions</Link>} bodyless>
              <DataTable columns={['Listing', 'Buyer', 'Amount', 'Status', 'Date']} rows={o.recentOrders.map((r) => [r.listing, r.buyer ?? '—', money(r.amountMinor, r.currency), <StatusBadge key="s" map={ORDER_STATUS} value={r.status} />, formatDateTime(r.createdAt)])} empty="No orders yet." />
            </Panel>
            <Panel title="Recent payouts" actions={<Link href="/admin/marketplace/payouts">All payouts</Link>} bodyless>
              <DataTable columns={['Seller', 'Amount', 'Status', 'Requested']} rows={o.recentPayouts.map((p) => [p.seller, money(p.amountMinor, p.currency), <StatusBadge key="s" map={PAYOUT_STATUS} value={p.status} />, formatDateTime(p.createdAt)])} empty="No payouts yet." />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
