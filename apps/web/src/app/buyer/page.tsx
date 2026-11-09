import Link from 'next/link';
import { ArrowRight, Download, Heart, Inbox, MessageSquare, Search, ShoppingBag, Store, Zap } from 'lucide-react';
import { ButtonLink, Grid, Metric, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { ListingTile, LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { type BrowsePage, type InquiryRow, type ListingCard, type MarketSummary, money, type Order } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Buyer Dashboard · Marketplace' };

/** Buyer Dashboard (V2 guide §3): every number comes from the signed-in account; neutral empty states otherwise. */
export default async function BuyerDashboard() {
  const [summary, orders, saved, inquiries, latest] = await Promise.all([
    apiGet<MarketSummary>('/user/marketplace/summary', { auth: true }),
    apiGet<Order[]>('/user/marketplace/my/purchases', { auth: true }),
    apiGet<{ savedAt: string; available: boolean; listing: ListingCard }[]>('/user/marketplace/saved', { auth: true }),
    apiGet<InquiryRow[]>('/user/marketplace/my/inquiries?role=sent', { auth: true }),
    apiGet<BrowsePage>('/user/marketplace/listings?sort=newest', { auth: true }),
  ]);
  if (!summary.ok) return <LoadError what="Your Marketplace dashboard" />;
  const b = summary.data.buyer;
  const activeInquiries = inquiries.ok ? inquiries.data.filter((i) => i.status !== 'CLOSED').slice(0, 4) : [];
  return (
    <>
      <PageHeader title="Marketplace – Buyer Dashboard" description="Discover, evaluate, and acquire digital assets, websites, and online businesses." />
      <Grid cols={4}>
        <Metric label="Saved Listings" value={b.saved} icon={<Heart size={22} />} tone="green" note={<Link href="/buyer/saved">Browse & save assets</Link>} />
        <Metric label="Active Inquiries" value={b.activeInquiries} icon={<MessageSquare size={22} />} tone="blue" note={<Link href="/buyer/inquiries">View inquiries</Link>} />
        <Metric label="Purchases" value={b.purchases} icon={<ShoppingBag size={22} />} tone="purple" note={<Link href="/buyer/purchases">View purchases</Link>} />
        <Metric label="Available Downloads" value={b.downloads} icon={<Download size={22} />} tone="amber" note={<Link href="/buyer/downloads">View downloads</Link>} />
      </Grid>
      <div className={m.two} style={{ marginTop: 16 }}>
        <div className={m.banner}>
          <div>
            <h2>Explore quality digital assets</h2>
            <p>Find websites, eCommerce stores, SaaS platforms and digital products reviewed by our team before they go live.</p>
          </div>
          <ButtonLink href="/buyer/browse" variant="green" icon={<ArrowRight size={18} />}>
            Browse Digital Assets
          </ButtonLink>
        </div>
        <Panel title="Quick Actions" actions={<Zap size={18} aria-hidden />}>
          <div className={m.quick}>
            <Link href="/buyer/browse">
              <Search size={22} aria-hidden />
              Browse Assets
            </Link>
            <Link href="/buyer/saved">
              <Heart size={22} aria-hidden />
              Saved Listings
            </Link>
            <Link href="/buyer/messages">
              <Inbox size={22} aria-hidden />
              Messages{b.unreadMessages ? ` (${b.unreadMessages})` : ''}
            </Link>
            <Link href="/buyer/downloads">
              <Download size={22} aria-hidden />
              My Downloads
            </Link>
          </div>
        </Panel>
      </div>
      <Grid cols={2} style={{ marginTop: 16 }}>
        <Panel title="Recent Purchases" actions={<Link href="/buyer/purchases">View all</Link>}>
          {orders.ok && orders.data.length ? (
            <ul className={m.list}>
              {orders.data.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link href={`/buyer/purchases/${o.id}`}>{o.listing.title}</Link> · {money(o.amountMinor, o.currency)} · {formatDate(o.paidAt ?? o.createdAt)}
                </li>
              ))}
            </ul>
          ) : (
            <StateView kind="empty" icon={<ShoppingBag size={34} />} title="No purchases yet" description="Your completed purchases will appear here." action={<ButtonLink href="/buyer/browse" variant="greenOutline" size="sm">Browse Digital Assets</ButtonLink>} />
          )}
        </Panel>
        <Panel title="Saved Listings" actions={<Link href="/buyer/saved">View all</Link>}>
          {saved.ok && saved.data.length ? (
            <ul className={m.list}>
              {saved.data.slice(0, 5).map((s) => (
                <li key={s.listing.id}>
                  <Link href={`/buyer/listings/${s.listing.id}`}>{s.listing.title}</Link> · {money(s.listing.askingPriceMinor, s.listing.currency)}
                  {!s.available && ' · no longer available'}
                </li>
              ))}
            </ul>
          ) : (
            <StateView kind="empty" icon={<Heart size={34} />} title="No saved listings yet" description="Save assets you're interested in for easy access later." action={<ButtonLink href="/buyer/browse" variant="greenOutline" size="sm">Browse & Save Listings</ButtonLink>} />
          )}
        </Panel>
        <Panel title="Active Inquiries" actions={<Link href="/buyer/inquiries">View all</Link>}>
          {activeInquiries.length ? (
            <ul className={m.list}>
              {activeInquiries.map((i) => (
                <li key={i.id}>
                  <Link href={`/buyer/inquiries/${i.id}`}>{i.listing.title}</Link> · {i.introStatus === 'PENDING' ? 'awaiting seller' : i.introStatus === 'APPROVED' ? 'introduction accepted' : 'declined'}
                </li>
              ))}
            </ul>
          ) : (
            <StateView kind="empty" icon={<MessageSquare size={34} />} title="No active inquiries yet" description="Your inquiries and seller responses will appear here." action={<ButtonLink href="/buyer/browse" variant="greenOutline" size="sm">Browse Assets & Send an Inquiry</ButtonLink>} />
          )}
        </Panel>
        <Panel title="New on the Marketplace" actions={<Link href="/buyer/browse">View all</Link>}>
          {latest.ok && latest.data.items.length ? (
            <div className={m.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {latest.data.items.slice(0, 2).map((l) => (
                <ListingTile key={l.id} l={l} href={`/buyer/listings/${l.id}`} />
              ))}
            </div>
          ) : (
            <StateView kind="empty" icon={<Store size={34} />} title="No listings yet" description="Listings appear here once they pass review." />
          )}
        </Panel>
      </Grid>
    </>
  );
}
