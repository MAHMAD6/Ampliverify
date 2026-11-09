import Link from 'next/link';
import { Clock, DollarSign, Landmark, Undo2, Wallet } from 'lucide-react';
import { Grid, Metric, Notice, Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { SellerGate } from '@/components/market/SellerGate';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type Balance, LEDGER_TYPE, type LedgerRow, money, PAYOUT_STATUS, type SellerProfile } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Payouts & Earnings · Marketplace' };

export default async function PayoutsOverview() {
  const profile = await apiGet<SellerProfile | null>('/user/marketplace/seller', { auth: true });
  if (profile.ok && !profile.data) return <SellerGate />;
  const [res, ledger] = await Promise.all([apiGet<Balance>('/user/marketplace/finances/balance', { auth: true }), apiGet<LedgerRow[]>('/user/marketplace/finances/ledger', { auth: true })]);
  if (!res.ok) return <LoadError what="Your balance" />;
  const b = res.data;
  const usd = b.balances.find((x) => x.currency === 'USD');
  const others = b.balances.filter((x) => x.currency !== 'USD');
  const threshold = money(b.payoutThresholdMinor, 'USD');
  return (
    <div className={m.stack}>
      <Grid cols={4}>
        <Metric label="Available for payout" value={money(usd?.availableMinor ?? 0, 'USD')} note={`Minimum payout ${threshold}`} icon={<Wallet size={22} />} tone="green" />
        <Metric label="Pending" value={money(usd?.pendingMinor ?? 0, 'USD')} note="Held until the hold period ends" icon={<Clock size={22} />} tone="amber" />
        <Metric label="Gross sales" value={money(usd?.grossSalesMinor ?? 0, 'USD')} note={`Fees ${money(usd?.feesMinor ?? 0, 'USD')}`} icon={<DollarSign size={22} />} tone="blue" />
        <Metric label="Paid out" value={money(usd?.paidOutMinor ?? 0, 'USD')} note={`Refunds ${money(usd?.refundsMinor ?? 0, 'USD')}`} icon={<Landmark size={22} />} tone="purple" />
      </Grid>
      <Panel title="Request a payout">
        {b.openPayout ? (
          <p style={{ margin: 0 }}>
            Payout of {money(b.openPayout.amountMinor, b.openPayout.currency)} is <StatusBadge map={PAYOUT_STATUS} value={b.openPayout.status} />. <Link href={`/seller/payouts/${b.openPayout.id}`}>View details</Link>
          </p>
        ) : !b.payoutsEnabled ? (
          <Notice tone="blue" title="Connect a payout account first.">
            Set it up under <Link href="/seller/payouts/method">Payout Method</Link>.
          </Notice>
        ) : b.canRequestPayout ? (
          <ActionButton path="/user/marketplace/finances/payouts" confirm={`Request a payout of ${money(usd?.availableMinor ?? 0, 'USD')}?`} successMessage="Payout requested. Our finance team reviews every payout.">
            Request payout of {money(usd?.availableMinor ?? 0, 'USD')}
          </ActionButton>
        ) : (
          <p className={m.muted} style={{ margin: 0 }}>
            Payouts start once your available balance reaches {threshold}.
          </p>
        )}
        <p className={m.muted} style={{ marginBottom: 0 }}>
          Each payout is approved and sent by two different members of our finance team. Refunds after a payout reduce your next balance.
        </p>
      </Panel>
      {others.length > 0 && (
        <Panel title="Other currencies">
          <ul className={m.list}>
            {others.map((o) => (
              <li key={o.currency}>
                {o.currency}: available {money(o.availableMinor, o.currency)}, pending {money(o.pendingMinor, o.currency)}. Payouts are currently made in USD only; contact support for other currencies.
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Recent activity" actions={<Link href="/seller/payouts/earnings">View all</Link>}>
        {ledger.ok && ledger.data.length ? (
          <ul className={m.list}>
            {ledger.data.slice(0, 8).map((e) => (
              <li key={e.id}>
                {LEDGER_TYPE[e.type] ?? e.type} · {money(e.amountMinor, e.currency)} · {e.listing ?? e.memo ?? ''} · {formatDateTime(e.createdAt)}
              </li>
            ))}
          </ul>
        ) : (
          <p className={m.muted} style={{ margin: 0 }}>
            <Undo2 size={14} aria-hidden /> No earnings yet. Sales of your digital products appear here.
          </p>
        )}
      </Panel>
    </div>
  );
}
