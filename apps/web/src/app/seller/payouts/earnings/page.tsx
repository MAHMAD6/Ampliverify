import { Button, DataTable, Field, Input, Panel, Select } from '@/components/ui';
import { LoadError } from '@/components/market/parts';
import { apiGet, qs } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { LEDGER_TYPE, type LedgerRow, money } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Earnings Breakdown · Marketplace' };

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ month?: string; type?: string }> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month : undefined;
  const type = sp.type && sp.type in LEDGER_TYPE ? sp.type : undefined;
  const res = await apiGet<LedgerRow[]>(`/user/marketplace/finances/ledger${qs({ month, type })}`, { auth: true });
  return (
    <div className={m.stack}>
      <Panel>
        <form className={m.filters} action="/seller/payouts/earnings">
          <Field label="Month" htmlFor="e-month">
            <Input id="e-month" name="month" type="month" defaultValue={month ?? ''} />
          </Field>
          <Field label="Type" htmlFor="e-type">
            <Select id="e-type" name="type" defaultValue={type ?? ''}>
              <option value="">All entries</option>
              {Object.entries(LEDGER_TYPE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Filter</Button>
        </form>
      </Panel>
      {!res.ok ? (
        <LoadError what="Earnings" />
      ) : (
        <Panel title="Ledger" description="Every sale, fee, refund and payout is an append-only entry." bodyless>
          <DataTable
            columns={['Date', 'Type', 'Item', 'Amount', 'Available from']}
            rows={res.data.map((e) => [formatDateTime(e.createdAt), LEDGER_TYPE[e.type] ?? e.type, e.listing ?? e.memo ?? '—', money(e.amountMinor, e.currency), e.availableAt ? formatDateTime(e.availableAt) : '—'])}
            empty="No entries for this filter."
          />
        </Panel>
      )}
    </div>
  );
}
