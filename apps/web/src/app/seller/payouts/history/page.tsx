import Link from 'next/link';
import { DataTable, Panel } from '@/components/ui';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { money, type Payout, PAYOUT_STATUS } from '@/lib/marketplace';

export const metadata = { title: 'Payout History · Marketplace' };

export default async function PayoutHistoryPage() {
  const res = await apiGet<Payout[]>('/user/marketplace/finances/payouts', { auth: true });
  if (!res.ok) return <LoadError what="Payout history" />;
  return (
    <Panel title="Payout history" bodyless>
      <DataTable
        columns={['Requested', 'Amount', 'Status', 'Paid', 'Reference']}
        rows={res.data.map((p) => [
          <Link key="l" href={`/seller/payouts/${p.id}`}>
            {formatDateTime(p.createdAt)}
          </Link>,
          money(p.amountMinor, p.currency),
          <StatusBadge key="s" map={PAYOUT_STATUS} value={p.status} />,
          formatDateTime(p.paidAt),
          p.providerTransferId ?? '—',
        ])}
        empty="No payouts yet."
      />
    </Panel>
  );
}
