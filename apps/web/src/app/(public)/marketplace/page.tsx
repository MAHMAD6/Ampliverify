import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, FileCheck2, Handshake, Lock, Search, ShieldCheck, Store } from 'lucide-react';
import { CtaBand, PageHero } from '@/components/public/Blocks';
import { ListingTile } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import type { BrowsePage, MarketMeta } from '@/lib/marketplace';
import { publicListingHref } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = {
  title: 'Marketplace: Buy and Sell Websites and Digital Assets',
  description: 'Browse reviewed websites, online businesses and downloadable digital products from verified sellers, or list your own digital asset.',
  alternates: { canonical: '/marketplace' },
};

/** Public Marketplace landing (V2 guide §4.1). Listings come from the live API; nothing is invented. */
export default async function MarketplaceLanding() {
  const [list, meta] = await Promise.all([apiGet<BrowsePage>('/public/marketplace/listings?sort=newest', { revalidate: 60 }), apiGet<MarketMeta>('/public/marketplace/meta', { revalidate: 300 })]);
  const items = list.ok ? list.data.items.slice(0, 6) : [];
  const total = list.ok ? list.data.total : 0;
  const threshold = meta.ok ? meta.data.terms.payoutThresholdMinor / 100 : 50;
  return (
    <>
      <PageHero eyebrow="AmpliVerify Marketplace" title="Buy and sell websites and digital assets with confidence" lead="Every listing is reviewed by our team before it goes live. Sellers complete identity checks, and verification badges say exactly what was checked." center>
        <form action="/marketplace/listings" role="search" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
          <input id="mq" name="q" aria-label="Search listings" placeholder="Search websites, niches or products" style={{ height: 52, minWidth: 'min(420px, 100%)', padding: '0 16px', borderRadius: 10, border: '1px solid var(--line2, #d9e2ec)', fontSize: 16 }} />
          <button type="submit" className={s.btn}>
            <Search size={18} /> Search
          </button>
        </form>
        <div className={s.heroActions}>
          <Link href="/marketplace/listings" className={s.btnOutline}>
            Browse all listings
          </Link>
          <Link href="/sell" className={s.btnOutline}>
            Sell a digital asset
          </Link>
        </div>
      </PageHero>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.sectionHead}>
            <div>
              <div className={s.eyebrow}>Latest listings</div>
              <h2 className={s.h2}>{total ? `${total} listing${total === 1 ? '' : 's'} available` : 'Listings'}</h2>
            </div>
            {items.length > 0 && (
              <Link href="/marketplace/listings" className={s.learn}>
                View all <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {items.length ? (
            <div className={m.grid}>
              {items.map((l) => (
                <ListingTile key={l.id} l={l} href={publicListingHref(l)} save={false} />
              ))}
            </div>
          ) : (
            <div className={s.card} style={{ textAlign: 'center' }}>
              <Store size={36} aria-hidden />
              <h3 className={s.cardTitle}>{list.ok ? 'No listings are live yet' : 'Listings are unavailable right now'}</h3>
              <p className={s.cardText}>{list.ok ? 'Be one of the first sellers on AmpliVerify.' : 'Please try again shortly.'}</p>
              <Link href="/sell" className={s.btn}>
                List your asset <ArrowRight size={18} />
              </Link>
            </div>
          )}
        </div>
      </section>
      <section className={s.sectionAlt}>
        <div className={s.container}>
          <div className={s.eyebrow}>Why AmpliVerify</div>
          <h2 className={s.h2}>Clear checks, protected payments</h2>
          <div className={s.grid4} style={{ marginTop: 24 }}>
            {[
              [<ShieldCheck key="i" size={24} />, 'Human review', 'Listings are approved by staff. Nothing is published automatically.'],
              [<BadgeCheck key="i" size={24} />, 'Distinct verification', 'Identity, business, ownership, traffic and financial checks are shown separately.'],
              [<Lock key="i" size={24} />, 'Secure checkout', 'Digital products are paid through our payment provider and delivered only after payment is confirmed.'],
              [<Handshake key="i" size={24} />, 'Guided acquisitions', 'Introductions, versioned offers, agreement and transfer steps for business sales.'],
            ].map(([icon, title, text]) => (
              <div key={String(title)} className={s.card}>
                <span className={s.icon} aria-hidden>
                  {icon}
                </span>
                <h3 className={s.cardTitle}>{title}</h3>
                <p className={s.cardText}>{text}</p>
              </div>
            ))}
          </div>
          <p className={s.cardText} style={{ marginTop: 20 }}>
            <FileCheck2 size={16} aria-hidden /> Sellers can request a payout once eligible earnings reach US ${threshold}. Read the <Link href="/digital-product-refund-policy">Digital Product Refund Policy</Link> and <Link href="/seller-guidelines">Seller Guidelines</Link>.
          </p>
        </div>
      </section>
      <CtaBand title="Ready to sell your website or digital product?" text="Create a free account, complete your seller profile and submit your listing for review." primary={{ label: 'Start selling', href: '/sell' }} secondary={{ label: 'How it works', href: '/marketplace/how-it-works' }} />
    </>
  );
}
