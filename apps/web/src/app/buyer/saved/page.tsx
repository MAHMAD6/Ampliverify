import { Heart } from 'lucide-react';
import { ButtonLink, PageHeader } from '@/components/ui';
import { Empty, ListingTile, LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import type { ListingCard } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Saved Listings · Marketplace' };

export default async function SavedPage() {
  const res = await apiGet<{ savedAt: string; available: boolean; listing: ListingCard }[]>('/user/marketplace/saved', { auth: true });
  return (
    <>
      <PageHeader title="Saved Listings" description="Assets you saved to compare and come back to. Removing one can be undone right away." />
      {!res.ok ? (
        <LoadError what="Saved listings" />
      ) : res.data.length === 0 ? (
        <Empty icon={<Heart size={40} />} title="No saved listings yet" description="Tap the heart on any listing to save it here." action={<ButtonLink href="/buyer/browse">Browse Digital Assets</ButtonLink>} />
      ) : (
        <div className={m.grid}>
          {res.data.map((s) => (
            <div key={s.listing.id} style={{ display: 'grid', gap: 6 }}>
              <ListingTile l={{ ...s.listing, saved: true }} href={`/buyer/listings/${s.listing.id}`} />
              {!s.available && <span className={m.muted}>No longer available</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
