import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { ButtonLink, DataTable, PageHeader, Panel } from '@/components/ui';
import { Empty, LoadError, StatusBadge } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type Deal, DEAL_STATUS, money, type Order, ORDER_STATUS } from '@/lib/marketplace';

export const metadata = { title: 'My Purchases · Marketplace' };

/** Digital-product orders and completed acquisitions, kept separate: an acquisition is not a download. */
export default async function PurchasesPage() {
  const [orders, deals] = await Promise.all([apiGet<Order[]>('/user/marketplace/my/purchases', { auth: true }), apiGet<Deal[]>('/user/marketplace/my/deals?role=buyer', { auth: true })]);
  if (!orders.ok) return <LoadError what="Your purchases" />;
  const acquisitions = deals.ok ? deals.data : [];
  return (
    <>
      <PageHeader title="My Purchases" description="Receipts for digital products and the status of businesses you are acquiring." />
      {orders.data.length === 0 && acquisitions.length === 0 ? (
        <Empty icon={<ShoppingBag size={40} />} title="No purchases yet" description="Your completed purchases will appear here." action={<ButtonLink href="/buyer/browse">Browse Digital Assets</ButtonLink>} />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Digital products" bodyless>
            <DataTable
              columns={['Item', 'Amount', 'Status', 'Date']}
              rows={orders.data.map((o) => [
                <Link key="l" href={`/buyer/purchases/${o.id}`}>
                  {o.listing.title}
                </Link>,
                money(o.amountMinor, o.currency) + (o.refundedMinor ? ` (refunded ${money(o.refundedMinor, o.currency)})` : ''),
                <StatusBadge key="s" map={ORDER_STATUS} value={o.status} />,
                formatDateTime(o.paidAt ?? o.createdAt),
              ])}
              empty="No digital-product orders."
            />
          </Panel>
          <Panel title="Business acquisitions" bodyless>
            <DataTable
              columns={['Business', 'Agreed price', 'Stage', 'Updated']}
              rows={acquisitions.map((d) => [
                <Link key="l" href={`/buyer/transactions/${d.id}`}>
                  {d.listing.title}
                </Link>,
                money(d.amountMinor, d.currency),
                <StatusBadge key="s" map={DEAL_STATUS} value={d.status} />,
                formatDateTime(d.updatedAt),
              ])}
              empty="No acquisitions."
            />
          </Panel>
        </div>
      )}
    </>
  );
}
