import { notFound } from 'next/navigation';
import { DataTable, KeyValue, Notice, Panel } from '@/components/ui';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { LEDGER_TYPE, money, type Payout, PAYOUT_STATUS } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Payout · Marketplace' };

export default async function PayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<Payout>(`/user/marketplace/finances/payouts/${id}`, { auth: true });
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This payout" />;
  const p = res.data;
  return (
    <div className={m.two}>
      <Panel title={`Payout of ${money(p.amountMinor, p.currency)}`} actions={<StatusBadge map={PAYOUT_STATUS} value={p.status} />}>
        {p.status === 'FAILED' && p.failureReason && (
          <Notice tone="amber" title="The transfer failed.">
            {p.failureReason} Our finance team will retry or contact you. The amount stays reserved meanwhile.
          </Notice>
        )}
        {p.status === 'CANCELED' && (
          <Notice tone="neutral" title="This payout was canceled.">
            {p.failureReason ?? ''} The amount was returned to your available balance.
          </Notice>
        )}
        <KeyValue label="Requested" value={formatDateTime(p.createdAt)} />
        <KeyValue label="Approved" value={formatDateTime(p.approvedAt)} />
        <KeyValue label="Paid" value={formatDateTime(p.paidAt)} />
        <KeyValue label="Transfer reference" value={p.providerTransferId ?? '—'} />
      </Panel>
      <Panel title="Ledger entries" bodyless>
        <DataTable columns={['Type', 'Amount', 'Date']} rows={(p.entries ?? []).map((e) => [LEDGER_TYPE[e.type] ?? e.type, money(e.amountMinor, p.currency), formatDateTime(e.createdAt)])} empty="No entries." />
      </Panel>
    </div>
  );
}
