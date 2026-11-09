import Link from 'next/link';
import { PackagePlus, Tags } from 'lucide-react';
import { ButtonLink, DataTable, PageHeader, Panel } from '@/components/ui';
import { Empty, LoadError, Pills, StatusBadge } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { kindLabel, LISTING_STATUS, type ListingStatus, money, type OwnListing } from '@/lib/marketplace';

export const metadata = { title: 'My Listings · Marketplace' };

const TABS: (ListingStatus | 'ALL')[] = ['ALL', 'DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'REJECTED', 'WITHDRAWN', 'SOLD'];

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = (TABS as string[]).includes(sp.status ?? '') ? (sp.status as ListingStatus | 'ALL') : 'ALL';
  const res = await apiGet<OwnListing[]>(`/user/marketplace/my/listings${status === 'ALL' ? '' : `?status=${status}`}`, { auth: true });
  return (
    <>
      <PageHeader title="My Listings" description="Drafts, listings in review and live listings. Editing a live listing sends it back to review." actions={<ButtonLink href="/seller/listings/new" icon={<PackagePlus size={16} />}>Create Listing</ButtonLink>} />
      <Pills label="Listing status" active={status} items={TABS.map((t) => ({ key: t, label: t === 'ALL' ? 'All' : LISTING_STATUS[t].label, href: t === 'ALL' ? '/seller/listings' : `/seller/listings?status=${t}` }))} />
      {!res.ok ? (
        <LoadError what="Your listings" />
      ) : res.data.length === 0 ? (
        <Empty icon={<Tags size={40} />} title={status === 'ALL' ? 'No listings yet' : 'No listings with this status'} description="Create a listing for a website, online business or digital product. It stays a draft until you submit it for review." action={<ButtonLink href="/seller/listings/new">Create Listing</ButtonLink>} />
      ) : (
        <Panel bodyless>
          <DataTable
            columns={['Listing', 'Type', 'Price', 'Status', 'Views', 'Inquiries', 'Offers', 'Updated']}
            rows={res.data.map((l) => [
              <Link key="l" href={`/seller/listings/${l.id}`}>
                {l.title}
              </Link>,
              kindLabel(l.kind),
              money(l.askingPriceMinor, l.currency),
              <StatusBadge key="s" map={LISTING_STATUS} value={l.status} />,
              l.viewCount,
              l.inquiries ?? 0,
              l.offers ?? 0,
              formatDateTime(l.updatedAt),
            ])}
          />
        </Panel>
      )}
    </>
  );
}
