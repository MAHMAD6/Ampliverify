import { notFound } from 'next/navigation';
import { LoadError } from '@/components/market/parts';
import { OfferView } from '@/components/market/views';
import { apiGet } from '@/lib/api';
import type { Offer } from '@/lib/marketplace';

export const metadata = { title: 'Offer · Marketplace' };

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<Offer>(`/user/marketplace/offers/${id}`, { auth: true });
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This offer" />;
  return <OfferView o={res.data} base="/seller" />;
}
