import { PageHeader } from '@/components/ui';
import { OfferList } from '@/components/market/lists';
import { apiGet } from '@/lib/api';
import type { Offer } from '@/lib/marketplace';

export const metadata = { title: 'Offers & Negotiations · Marketplace' };

export default async function SellerOffersPage() {
  const res = await apiGet<Offer[]>('/user/marketplace/my/offers?role=seller', { auth: true });
  return (
    <>
      <PageHeader title="Offers & Negotiations" description="Offers on your business listings. Accept, decline or counter; each version of the terms is kept." />
      <OfferList rows={res.ok ? res.data : null} base="/seller" />
    </>
  );
}
