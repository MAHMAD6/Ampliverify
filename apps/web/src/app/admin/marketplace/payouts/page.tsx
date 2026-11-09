import { Banknote } from 'lucide-react';
import { DataTable, Field, FormGrid, Input, Notice, PageHeader, Panel, Select } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { AdminMarketNav } from '@/components/admin/market/AdminMarketNav';
import { MinorForm, NoteAction } from '@/components/market/forms';
import { Pills, StatusBadge } from '@/components/market/parts';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { money, type Payout, PAYOUT_STATUS } from '@/lib/marketplace';

export const metadata = { title: 'Commissions & Payouts · Admin' };

type AdminPayout = Payout & { approvedBy: string | null; seller: { email: string; name: string | null; payoutsEnabled: boolean } };
const FILTERS = ['REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED', 'ALL'];

/** Dual control: one administrator approves, a different one processes. Transfers are idempotent. */
export default async function AdminPayouts({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status ?? '') ? sp.status! : 'REQUESTED';
  const rows = await adminGet<AdminPayout[]>(`/admin/marketplace/payouts${status === 'ALL' ? '' : `?status=${status}`}`);
  return (
    <>
      <PageHeader title="Commissions & Payouts" description="Seller payout requests from the $50 minimum. A payout you approve must be processed by another administrator." />
      <AdminMarketNav active="payouts" />
      <Pills items={FILTERS.map((f) => ({ key: f, label: f === 'ALL' ? 'All' : (PAYOUT_STATUS[f]?.label ?? f), href: `/admin/marketplace/payouts?status=${f}` }))} active={status} label="Status" />
      <div style={{ marginTop: 14 }}>
        {!rows ? (
          <Panel>
            <StateView kind="error" title="Payouts could not be loaded with your permissions." description="Payouts need the marketplace.payouts permission." />
          </Panel>
        ) : rows.length === 0 ? (
          <Panel>
            <StateView kind="empty" icon={<Banknote size={36} />} title="No payouts" description={status === 'REQUESTED' ? 'No payout requests are waiting.' : 'No payouts with this status.'} />
          </Panel>
        ) : (
          <Panel bodyless>
            <DataTable
              columns={['Seller', 'Amount', 'Status', 'Requested', 'Approved', 'Paid', 'Detail', 'Action']}
              rows={rows.map((p) => [
                <span key="s">
                  <b>{p.seller.name ?? p.seller.email}</b>
                  <br />
                  <small>
                    {p.seller.email} · {p.seller.payoutsEnabled ? 'payout account ready' : 'payout account not ready'}
                  </small>
                </span>,
                money(p.amountMinor, p.currency),
                <StatusBadge key="st" map={PAYOUT_STATUS} value={p.status} />,
                formatDateTime(p.createdAt),
                formatDateTime(p.approvedAt),
                formatDateTime(p.paidAt),
                p.failureReason ?? p.providerTransferId ?? '—',
                <div key="a" style={{ display: 'grid', gap: 6 }}>
                  {p.status === 'REQUESTED' && (
                    <ActionButton path={`/admin/marketplace/payouts/${p.id}/action`} body={{ action: 'APPROVE' }} size="sm" confirm={`Approve ${money(p.amountMinor, p.currency)}?`} successMessage="Payout approved. Another administrator must process it.">
                      Approve
                    </ActionButton>
                  )}
                  {(p.status === 'APPROVED' || p.status === 'FAILED') && (
                    <ActionButton path={`/admin/marketplace/payouts/${p.id}/action`} body={{ action: 'PROCESS' }} size="sm" confirm={`Send ${money(p.amountMinor, p.currency)} to the seller now?`} successMessage="Transfer sent.">
                      {p.status === 'FAILED' ? 'Retry transfer' : 'Process transfer'}
                    </ActionButton>
                  )}
                  {['REQUESTED', 'APPROVED', 'FAILED'].includes(p.status) && <NoteAction path={`/admin/marketplace/payouts/${p.id}/action`} body={{ action: 'CANCEL' }} label="Cancel" placeholder="Reason (shown to the seller)" required variant="ghost" successMessage="Payout canceled; the balance was returned." />}
                </div>,
              ])}
            />
          </Panel>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <Panel title="Ledger adjustment" description="Manual corrections to a seller's balance. Use a negative amount to debit. Every adjustment needs a reason and is audited.">
          <Notice tone="amber" title="Adjustments change what a seller can withdraw.">Find the seller's user ID on the Sellers tab.</Notice>
          <div style={{ marginTop: 10 }}>
            <MinorForm path="/admin/marketplace/ledger/adjustments" minorFields={['amountMinor']} submitLabel="Record adjustment" successMessage="Adjustment recorded." resetOnSuccess>
              <FormGrid>
                <Field label="Seller user ID" htmlFor="adj-user">
                  <Input id="adj-user" name="sellerUserId" required pattern="[0-9a-fA-F-]{36}" />
                </Field>
                <Field label="Amount" htmlFor="adj-amount">
                  <Input id="adj-amount" name="amountMinor" type="number" data-type="number" step="0.01" required />
                </Field>
                <Field label="Currency" htmlFor="adj-cur">
                  <Select id="adj-cur" name="currency" defaultValue="USD">
                    {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reason" htmlFor="adj-reason">
                  <Input id="adj-reason" name="reason" required maxLength={200} />
                </Field>
              </FormGrid>
            </MinorForm>
          </div>
        </Panel>
      </div>
    </>
  );
}
