import { notFound } from 'next/navigation';
import { LoadError } from '@/components/market/parts';
import { ThreadView } from '@/components/market/views';
import { apiGet } from '@/lib/api';
import type { Thread } from '@/lib/marketplace';

export const metadata = { title: 'Conversation · Marketplace' };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<Thread>(`/user/marketplace/inquiries/${id}`, { auth: true });
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This conversation" />;
  return <ThreadView t={res.data} base="/seller" />;
}
