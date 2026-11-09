import { notFound } from 'next/navigation';
import { ListingDetailView } from '@/components/market/ListingDetailView';
import { LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import type { ListingDetail, MarketMeta } from '@/lib/marketplace';

export const metadata = { title: 'Listing · Marketplace' };

export default async function BuyerListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [res, meta] = await Promise.all([apiGet<ListingDetail>(`/user/marketplace/listings/${id}`, { auth: true }), apiGet<MarketMeta>('/public/marketplace/meta', { revalidate: 60 })]);
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This listing" />;
  return <ListingDetailView l={res.data} meta={meta.ok ? meta.data : null} mode="buyer" crumbs={[{ label: 'Browse', href: '/buyer/browse' }, { label: res.data.title }]} />;
}
