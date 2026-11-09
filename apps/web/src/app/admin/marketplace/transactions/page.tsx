import { ArrowRightLeft, LifeBuoy } from 'lucide-react';
import { DataTable, Field, FormGrid, Input, PageHeader, Panel, Select } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { AdminMarketNav } from '@/components/admin/market/AdminMarketNav';
import { MinorForm } from '@/components/market/forms';
import { Pills, StatusBadge } from '@/components/market/parts';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { type Case, CASE_STATUS, DEAL_STATUS, kindLabel, money, ORDER_STATUS } from '@/lib/marketplace';

export const metadata = { title: 'Transactions & Disputes · Admin' };

type Tx = { id: string; kind: string; listing: string; buyer: string; seller: string; amountMinor: number; feeMinor: number; refundedMinor: number; currency: string; status: string; createdAt: string };
type AdminCase = Case & { buyer: { email: string; displayName: string | null }; order: { id: string; title: string; amountMinor: number; refundedMinor: number; currency: string; status: string; paidAt: string | null } | null };
const CASE_FILTERS = ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'REFUNDED', 'DENIED', 'CLOSED', 'ALL'];

export default async function AdminTransactions({ searchParams }: { searchParams: Promise<{ cases?: string }> }) {
  const sp = await searchParams;
  const cs = CASE_FILTERS.includes(sp.cases ?? '') ? sp.cases! : 'OPEN';
  const [tx, cases] = await Promise.all([adminGet<Tx[]>('/admin/marketplace/transactions'), adminGet<AdminCase[]>(`/admin/marketplace/cases${cs === 'ALL' ? '' : `?status=${cs}`}`)]);
  return (
    <>
      <PageHeader title="Transactions & Disputes" description="Digital product orders, business acquisitions, refund requests and disputes. Refunds go through the payment provider once, even if retried." />
      <AdminMarketNav active="transactions" />
      <Panel title="Refunds & disputes">
        <Pills items={CASE_FILTERS.map((f) => ({ key: f, label: f === 'ALL' ? 'All' : (CASE_STATUS[f]?.label ?? f), href: `/admin/marketplace/transactions?cases=${f}` }))} active={cs} label="Case status" />
        <div style={{ marginTop: 12 }}>
          {!cases ? (
            <StateView kind="error" title="Cases could not be loaded with your permissions." />
          ) : cases.length === 0 ? (
            <StateView kind="empty" icon={<LifeBuoy size={32} />} title="No cases" description="Refund requests and reported issues appear here." />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {cases.map((c) => {
                const open = !['REFUNDED', 'DENIED', 'CLOSED'].includes(c.status);
                const currency = c.order?.currency ?? 'USD';
                return (
                  <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <b>
                        {c.kind === 'REFUND' ? 'Refund request' : 'Issue'} · {c.reason}
                      </b>
                      <StatusBadge map={CASE_STATUS} value={c.status} />
                    </div>
                    <p style={{ margin: '6px 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.details}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                      {c.buyer.displayName ?? c.buyer.email} ({c.buyer.email}) · {c.order ? `${c.order.title} · paid ${money(c.order.amountMinor, currency)} · refunded ${money(c.order.refundedMinor, currency)}` : 'Business acquisition'} · requested {money(c.requestedAmountMinor, currency)} · opened {formatDateTime(c.createdAt)}
                    </p>
                    {c.decisionNote && <p style={{ margin: '6px 0 0', fontSize: 13 }}>Decision: {c.decisionNote}</p>}
                    {open && (
                      <div style={{ marginTop: 10 }}>
                        <MinorForm path={`/admin/marketplace/cases/${c.id}/resolve`} minorFields={['amountMinor']} dropEmpty={['amountMinor']} submitLabel="Record decision" successMessage="Decision recorded.">
                          <FormGrid>
                            <Field label="Decision" htmlFor={`cd-${c.id}`}>
                              <Select id={`cd-${c.id}`} name="decision" defaultValue="REVIEW">
                                <option value="REVIEW">Mark under review</option>
                                {c.order && <option value="APPROVE_REFUND">Approve refund</option>}
                                <option value="DENY">Deny</option>
                                <option value="CLOSE">Close</option>
                              </Select>
                            </Field>
                            {c.order && (
                              <Field label={`Refund amount (${currency}, optional)`} htmlFor={`ca-${c.id}`} hint="Defaults to the requested amount.">
                                <Input id={`ca-${c.id}`} name="amountMinor" type="number" data-type="number" min={0} step="0.01" />
                              </Field>
                            )}
                            <Field label="Note (required for decisions)" htmlFor={`cn-${c.id}`}>
                              <Input id={`cn-${c.id}`} name="note" maxLength={1000} />
                            </Field>
                          </FormGrid>
                        </MinorForm>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Panel>
      <div style={{ marginTop: 16 }}>
        {!tx ? (
          <Panel>
            <StateView kind="error" title="Transactions could not be loaded with your permissions." />
          </Panel>
        ) : tx.length === 0 ? (
          <Panel>
            <StateView kind="empty" icon={<ArrowRightLeft size={36} />} title="No transactions yet" description="Orders and acquisitions appear here once buyers start them." />
          </Panel>
        ) : (
          <Panel title="All transactions" bodyless>
            <DataTable
              columns={['Type', 'Listing', 'Buyer', 'Seller', 'Amount', 'Commission', 'Refunded', 'Status', 'Date']}
              rows={tx.map((t) => [kindLabel(t.kind === 'ACQUISITION' ? 'BUSINESS' : 'DIGITAL_PRODUCT'), t.listing, t.buyer, t.seller, money(t.amountMinor, t.currency), money(t.feeMinor, t.currency), money(t.refundedMinor, t.currency), <StatusBadge key="s" map={t.kind === 'ACQUISITION' ? DEAL_STATUS : ORDER_STATUS} value={t.status} />, formatDateTime(t.createdAt)])}
            />
          </Panel>
        )}
      </div>
    </>
  );
}
