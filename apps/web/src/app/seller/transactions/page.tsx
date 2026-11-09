import Link from 'next/link';
import { Repeat } from 'lucide-react';
import { DataTable, PageHeader, Panel } from '@/components/ui';
import { Empty, LoadError, StatusBadge } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type Deal, DEAL_STATUS, money, type Order, ORDER_STATUS } from '@/lib/marketplace';

export const metadata = { title: 'Seller Transactions · Marketplace' };

export default async function SellerTransactionsPage() {
  const [sales, deals] = await Promise.all([apiGet<Order[]>('/user/marketplace/finances/sales', { auth: true }), apiGet<Deal[]>('/user/marketplace/my/deals?role=seller', { auth: true })]);
  if (!sales.ok || !deals.ok) return <LoadError what="Your transactions" />;
  return (
    <>
      <PageHeader title="Seller Transactions" description="Digital-product sales and acquisition deals for your listings." />
      {sales.data.length === 0 && deals.data.length === 0 ? (
        <Empty icon={<Repeat size={40} />} title="No transactions yet" description="Sales and accepted offers appear here." />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Acquisition deals" bodyless>
            <DataTable
              columns={['Business', 'Agreed price', 'Stage', 'Updated']}
              rows={deals.data.map((d) => [
                <Link key="l" href={`/seller/transactions/${d.id}`}>
                  {d.listing.title}
                </Link>,
                money(d.amountMinor, d.currency),
                <StatusBadge key="s" map={DEAL_STATUS} value={d.status} />,
                formatDateTime(d.updatedAt),
              ])}
              empty="No acquisition deals."
            />
          </Panel>
          <Panel title="Digital-product sales" bodyless>
            <DataTable
              columns={['Product', 'Amount', 'Platform fee', 'Refunded', 'Status', 'Date']}
              rows={sales.data.map((o) => [o.listing.title, money(o.amountMinor, o.currency), money(o.platformFeeMinor ?? 0, o.currency), money(o.refundedMinor, o.currency), <StatusBadge key="s" map={ORDER_STATUS} value={o.status} />, formatDateTime(o.paidAt ?? o.createdAt)])}
              empty="No sales yet."
            />
          </Panel>
        </div>
      )}
    </>
  );
}
