import { PageHeader } from '@/components/ui';
import { OfferList } from '@/components/market/lists';
import { apiGet } from '@/lib/api';
import type { Offer } from '@/lib/marketplace';

export const metadata = { title: 'My Offers · Marketplace' };

export default async function BuyerOffersPage() {
  const res = await apiGet<Offer[]>('/user/marketplace/my/offers?role=buyer', { auth: true });
  return (
    <>
      <PageHeader title="My Offers" description="Offers and counteroffers on business acquisitions. Every version of the terms is kept." />
      <OfferList rows={res.ok ? res.data : null} base="/buyer" />
    </>
  );
}
