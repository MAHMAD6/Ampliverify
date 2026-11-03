import { ArrowRightLeft, MessageSquare, PackagePlus, Search, ShoppingBag, Store, Tags, Wallet } from 'lucide-react';
import { ButtonLink, Notice, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { type MarketSummary, money } from '@/lib/marketplace';
import s from '@/components/app/marketplace/market.module.css';

export const metadata = { title: 'Marketplace' };

/** Marketplace Dashboard: buyer and seller overview from recorded data only. */
export default async function MarketplaceDashboard() {
  const res = await apiGet<MarketSummary>('/user/marketplace/summary', { auth: true });
  if (!res.ok) {
    return (
      <Panel>
        <StateView kind="error" title="The Marketplace could not be loaded" description={'Please try again shortly.'} />
      </Panel>
    );
  }
  const { seller, buyer, marketplace } = res.data;
  const earnings = seller.earnings[0];
  const threshold = money(seller.payoutThresholdMinor, earnings?.currency ?? 'USD');
  return (
    <>
      <PageHeader
        title="Marketplace Dashboard"
        description="Buy and sell websites, domains and other digital assets."
        actions={
          <>
            <ButtonLink href="/app/marketplace/browse" variant="outline" icon={<Search size={16} />}>
              Browse Digital Assets
            </ButtonLink>
            <ButtonLink href="/app/marketplace/sell" icon={<PackagePlus size={16} />}>
              Sell a Digital Asset
            </ButtonLink>
          </>
        }
      />
      <div style={{ display: 'grid', gap: 16 }}>
        <Panel title="Buying" description={`${marketplace.publishedListings.toLocaleString('en-US')} listing${marketplace.publishedListings === 1 ? '' : 's'} currently live in the Marketplace.`}>
          <div className={s.stats}>
            <a href="/app/marketplace/browse" className={s.stat} style={{ textDecoration: 'none' }}>
              <Store size={18} aria-hidden />
              <b>{marketplace.publishedListings.toLocaleString('en-US')}</b>
              <span>Live listings</span>
            </a>
            <a href="/app/marketplace/inquiries?role=sent" className={s.stat} style={{ textDecoration: 'none' }}>
              <MessageSquare size={18} aria-hidden />
              <b>{buyer.inquiriesSent}</b>
              <span>Inquiries you sent</span>
            </a>
            <a href="/app/marketplace/purchases" className={s.stat} style={{ textDecoration: 'none' }}>
              <ShoppingBag size={18} aria-hidden />
              <b>{buyer.purchases}</b>
              <span>Purchases</span>
            </a>
          </div>
        </Panel>

        <Panel title="Selling" description="Your listings, buyer inquiries and recorded sales.">
          {seller.listings === 0 ? (
            <StateView
              kind="empty"
              icon={<Tags size={36} />}
              title="You have no listings yet"
              description="List a website or other digital asset. Our team reviews every listing before it goes live."
              action={<ButtonLink href="/app/marketplace/sell">Sell a Digital Asset</ButtonLink>}
            />
          ) : (
            <div className={s.stats}>
              <a href="/app/marketplace/listings" className={s.stat} style={{ textDecoration: 'none' }}>
                <Tags size={18} aria-hidden />
                <b>{seller.listings}</b>
                <span>
                  Listings · {seller.byStatus.PUBLISHED ?? 0} live · {seller.byStatus.PENDING_REVIEW ?? 0} in review
                </span>
              </a>
              <a href="/app/marketplace/inquiries" className={s.stat} style={{ textDecoration: 'none' }}>
                <MessageSquare size={18} aria-hidden />
                <b>{seller.openInquiries}</b>
                <span>Open buyer inquiries</span>
              </a>
              <a href="/app/marketplace/transactions" className={s.stat} style={{ textDecoration: 'none' }}>
                <ArrowRightLeft size={18} aria-hidden />
                <b>{seller.completedSales}</b>
                <span>Completed sales</span>
              </a>
            </div>
          )}
        </Panel>

        <Panel title="Seller earnings & payouts" description="Earnings come only from completed, recorded sales.">
          <div className={s.stats}>
            <div className={s.stat}>
              <Wallet size={18} aria-hidden />
              <b>{earnings ? money(earnings.amountMinor, earnings.currency) : money(0, 'USD')}</b>
              <span>Total earnings</span>
            </div>
            <div className={s.stat}>
              <b>{threshold}</b>
              <span>Minimum payout</span>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Notice tone="neutral" title="Payouts are not available yet.">
              Eligible earnings become payable once they reach {threshold}. Payouts start when the verified payout provider is connected; nothing is paid out before then.
            </Notice>
          </div>
        </Panel>
      </div>
    </>
  );
}
