import { notFound } from 'next/navigation';
import { LoadError } from '@/components/market/parts';
import { DealView } from '@/components/market/views';
import { apiGet } from '@/lib/api';
import type { Deal } from '@/lib/marketplace';

export const metadata = { title: 'Transaction · Marketplace' };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<Deal>(`/user/marketplace/deals/${id}`, { auth: true });
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This transaction" />;
  return <DealView d={res.data} base="/seller" />;
}
