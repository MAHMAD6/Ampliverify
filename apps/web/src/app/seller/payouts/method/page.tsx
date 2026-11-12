import { Landmark } from 'lucide-react';
import { KeyValue, Notice, Panel } from '@/components/ui';
import { ActionButton, RedirectButton } from '@/components/ui/actions';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { PayoutConnect } from '@/components/market/PayoutConnect';
import { SellerGate } from '@/components/market/SellerGate';
import { apiGet } from '@/lib/api';
import { CHECK_STATUS, type MarketMeta, type SellerProfile } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Payout Method · Marketplace' };

export default async function PayoutMethodPage() {
  const [res, meta] = await Promise.all([apiGet<SellerProfile | null>('/user/marketplace/seller', { auth: true }), apiGet<MarketMeta>('/public/marketplace/meta', { revalidate: 60 })]);
  if (!res.ok) return <LoadError what="Payout method" />;
  const p = res.data;
  if (!p) return <SellerGate />;
  const ready = meta.ok && meta.data.terms.paymentsConfigured;
  return (
    <Panel title="Payout method" description="Payouts are sent with Stripe Connect. You enter bank details on Stripe; AmpliVerify never sees or stores them." actions={<StatusBadge map={CHECK_STATUS} value={p.checks.payout} />}>
      <KeyValue label="Account connected" value={p.payoutAccountConnected ? 'Yes' : 'No'} />
      <KeyValue label="Payouts enabled" value={p.payoutsEnabled ? 'Yes' : 'No'} />
      <div className={m.actions} style={{ marginTop: 12 }}>
        {!ready ? (
          <Notice tone="neutral">Payout accounts are not available yet.</Notice>
        ) : p.checks.identity !== 'APPROVED' ? (
          <Notice tone="blue">Your identity must be verified before you connect a payout account.</Notice>
        ) : (
          <>
            {!p.payoutsEnabled && !p.payoutAccountConnected && <PayoutConnect />}
            {!p.payoutsEnabled && p.payoutAccountConnected && (
              <RedirectButton path="/user/marketplace/seller/payout-account" icon={<Landmark size={16} />}>
                Continue setup on Stripe
              </RedirectButton>
            )}
            {p.payoutAccountConnected && (
              <ActionButton path="/user/marketplace/seller/payout-account/refresh" variant="outline" successMessage="Status refreshed.">
                Refresh status
              </ActionButton>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
