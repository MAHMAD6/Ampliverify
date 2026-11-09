import { DataTable, Panel } from '@/components/ui';
import { LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { money, type Statement } from '@/lib/marketplace';
import { monthLabel } from '@/lib/valuation';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Tax & Statements · Marketplace' };

export default async function StatementsPage() {
  const res = await apiGet<Statement[]>('/user/marketplace/finances/statements', { auth: true });
  if (!res.ok) return <LoadError what="Statements" />;
  return (
    <div className={m.stack}>
      <Panel title="Monthly statements" description="Totals per month from your seller ledger. Keep them for your tax return; AmpliVerify does not give tax advice." bodyless>
        <DataTable
          columns={['Month', 'Currency', 'Sales', 'Fees', 'Refunds', 'Payouts', 'Adjustments', 'Net earnings']}
          rows={res.data.map((s) => [
            `${monthLabel(s.month)} ${s.month.slice(0, 4)}`,
            s.currency,
            money(s.salesMinor, s.currency),
            money(s.feesMinor, s.currency),
            money(s.refundsMinor, s.currency),
            money(s.payoutsMinor, s.currency),
            money(s.adjustmentsMinor, s.currency),
            money(s.salesMinor - s.feesMinor - s.refundsMinor + s.adjustmentsMinor, s.currency),
          ])}
          empty="No statements yet. A statement appears for each month with activity."
        />
      </Panel>
      <p className={m.muted}>Tax forms required in your country (for example a W-9 or W-8BEN) are collected by Stripe during payout setup.</p>
    </div>
  );
}
