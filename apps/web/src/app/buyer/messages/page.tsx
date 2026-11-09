import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Badge, DataTable, PageHeader, Panel } from '@/components/ui';
import { Empty, LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Conversation } from '@/lib/marketplace';

export const metadata = { title: 'Messages · Marketplace' };

/** Conversations you take part in, as buyer or seller; only open after an accepted introduction. */
export default async function MessagesPage() {
  const res = await apiGet<Conversation[]>('/user/marketplace/messages', { auth: true });
  return (
    <>
      <PageHeader title="Messages" description="Conversations with sellers and buyers. Only participants can read a conversation." />
      {!res.ok ? (
        <LoadError what="Messages" />
      ) : res.data.length === 0 ? (
        <Empty icon={<MessageSquare size={40} />} title="No messages yet" description="A conversation opens when a seller accepts an introduction or answers a question." />
      ) : (
        <Panel bodyless>
          <DataTable
            columns={['Listing', 'With', 'Last message', 'Unread', 'Updated']}
            rows={res.data.map((c) => [
              <Link key="l" href={`${c.role === 'SELLER' ? '/seller' : '/buyer'}/inquiries/${c.id}`}>
                {c.listing.title}
              </Link>,
              `${c.counterpart} (${c.role === 'SELLER' ? 'buyer' : 'seller'})`,
              c.lastMessage ? `${c.lastMessage.mine ? 'You: ' : ''}${c.lastMessage.body}` : '—',
              c.unread ? <Badge key="u" tone="green">{c.unread}</Badge> : '—',
              formatDateTime(c.updatedAt),
            ])}
          />
        </Panel>
      )}
    </>
  );
}
