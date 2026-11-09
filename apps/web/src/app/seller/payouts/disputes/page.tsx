import { DataTable, Panel } from '@/components/ui';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type Case, CASE_STATUS, money } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Refunds & Disputes · Marketplace' };

export default async function SellerDisputesPage() {
  const res = await apiGet<Case[]>('/user/marketplace/my/cases?role=seller', { auth: true });
  if (!res.ok) return <LoadError what="Refunds and disputes" />;
  return (
    <div className={m.stack}>
      <Panel title="Refund requests, issues and disputes" description="Our team decides each case. An approved refund is recorded in your ledger." bodyless>
        <DataTable
          columns={['Opened', 'Kind', 'Reason', 'Requested', 'Approved', 'Status', 'Decision']}
          rows={res.data.map((c) => [formatDateTime(c.createdAt), c.kind === 'REFUND' ? 'Refund' : c.kind === 'DISPUTE' ? 'Card dispute' : 'Issue', c.reason, c.requestedAmountMinor !== null ? money(c.requestedAmountMinor, 'USD') : '—', c.approvedAmountMinor !== null ? money(c.approvedAmountMinor, 'USD') : '—', <StatusBadge key="s" map={CASE_STATUS} value={c.status} />, c.decisionNote ?? '—'])}
          empty="No refund requests or disputes."
        />
      </Panel>
    </div>
  );
}
