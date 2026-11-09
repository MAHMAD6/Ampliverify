import Link from 'next/link';
import { Notice, PageHeader } from '@/components/ui';
import { ListingForm } from '@/components/market/ListingForm';
import { apiGet } from '@/lib/api';
import type { SellerProfile } from '@/lib/marketplace';

export const metadata = { title: 'Create Listing · Marketplace' };

export default async function NewListingPage() {
  const profile = await apiGet<SellerProfile | null>('/user/marketplace/seller', { auth: true });
  const p = profile.ok ? profile.data : null;
  return (
    <>
      <PageHeader title="Create Listing" description="Save a draft, add images and files, then submit it for review. Listings are never published automatically." crumbs={[{ label: 'My Listings', href: '/seller/listings' }, { label: 'Create Listing' }]} />
      {(!p || p.checks.identity === 'NOT_STARTED' || p.checks.identity === 'REJECTED') && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="blue" title="You can save drafts now.">
            To submit for review you need a <Link href="/seller">seller profile</Link> and a submitted <Link href="/seller/verification">identity check</Link>.
          </Notice>
        </div>
      )}
      <ListingForm />
    </>
  );
}
