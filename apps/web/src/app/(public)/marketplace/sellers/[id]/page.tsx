import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck, Store } from 'lucide-react';
import { Badge, KeyValue, PageHeader, Panel } from '@/components/ui';
import { Empty, ListingTile, LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { type ListingCard, type PublicSeller, publicListingHref } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';
import s from '@/components/public/site.module.css';

type SellerPage = { seller: PublicSeller | null; listings: ListingCard[] };
const load = (id: string) => apiGet<SellerPage>(`/public/marketplace/sellers/${id}`, { revalidate: 60 });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: 'Seller not found' };
  const res = await load(id);
  return res.ok && res.data.seller ? { title: `${res.data.seller.displayName} · Seller`, description: res.data.seller.headline ?? `Listings by ${res.data.seller.displayName} on the AmpliVerify Marketplace.` } : { title: 'Seller not found', robots: { index: false } };
}

export default async function PublicSellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await load(id);
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This seller" />;
  const p = res.data.seller;
  if (!p) notFound();
  return (
    <section className={s.section} style={{ paddingTop: 32 }}>
      <div className={s.container}>
        <PageHeader
          title={p.displayName}
          description={p.headline ?? undefined}
          crumbs={[{ label: 'Marketplace', href: '/marketplace' }, { label: 'Sellers' }, { label: p.displayName }]}
          actions={
            <div className={m.actions}>
              {p.checks.identity && (
                <Badge tone="green">
                  <BadgeCheck size={14} aria-hidden /> Identity verified
                </Badge>
              )}
              {p.checks.business && <Badge tone="green">Business verified</Badge>}
            </div>
          }
        />
        <div className={m.two}>
          <div className={m.stack}>
            {res.data.listings.length ? (
              <div className={m.grid}>
                {res.data.listings.map((l) => (
                  <ListingTile key={l.id} l={l} href={publicListingHref(l)} save={false} />
                ))}
              </div>
            ) : (
              <Empty icon={<Store size={36} />} title="No live listings" description="This seller has no listings available right now." />
            )}
          </div>
          <Panel title="About the seller">
            {p.bio && <p className={m.prose} style={{ marginTop: 0 }}>{p.bio}</p>}
            <KeyValue label="Member since" value={formatDate(p.memberSince)} />
            <KeyValue label="Location" value={p.location ?? '—'} />
            <KeyValue label="Live listings" value={p.liveListings} />
            <KeyValue label="Sold listings" value={p.soldListings} />
            {p.website && <KeyValue label="Website" value={<a href={p.website} target="_blank" rel="noopener noreferrer nofollow">{p.website.replace(/^https?:\/\//, '')}</a>} />}
            <p className={m.muted}>Identity verification confirms who the seller is. It does not verify each listing’s traffic or revenue.</p>
          </Panel>
        </div>
      </div>
    </section>
  );
}
