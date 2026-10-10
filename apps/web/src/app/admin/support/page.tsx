import Link from 'next/link';
import { Clock3, Inbox, LifeBuoy, MessageSquareReply } from 'lucide-react';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime, matchesQ, TICKET_TONE, ticketLabel } from '@/lib/admin-data';

export const metadata = { title: 'Support Requests' };

type Ticket = { id: string; subject: string; category: string; priority: string; status: string; createdAt: string; updatedAt: string; user: { id: string; email: string; displayName: string | null }; workspace: { id: string; name: string }; _count: { messages: number } };

const TABS: Record<string, string[] | null> = { open: ['OPEN', 'IN_PROGRESS'], waiting: ['WAITING_ON_CUSTOMER'], resolved: ['RESOLVED', 'CLOSED'], all: null };

/** Support requests opened by customers from Help & Support; staff replies notify the customer. */
export default async function SupportTicketsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'open', q } = await searchParams;
  const tickets = await adminGet<Ticket[]>('/admin/support-tickets');
  const list = tickets ?? [];
  const n = (k: string) => (tickets ? list.filter((t) => TABS[k]!.includes(t.status)).length : undefined);
  const rows = list.filter((t) => (!TABS[tab] || TABS[tab]!.includes(t.status)) && matchesQ(q, t.subject, t.user.email, t.user.displayName, t.workspace.name));
  return (
    <AdminList
      section="Support"
      title="Support Requests"
      description="Answer customer requests opened from Help & Support."
      metrics={[
        { label: 'Open', icon: <Inbox size={24} />, tone: 'blue', value: n('open') },
        { label: 'Waiting on Customer', icon: <Clock3 size={24} />, tone: 'amber', value: n('waiting') },
        { label: 'Resolved / Closed', icon: <LifeBuoy size={24} />, tone: 'green', value: n('resolved') },
        { label: 'Urgent / High', icon: <MessageSquareReply size={24} />, tone: 'red', value: tickets ? list.filter((t) => ['URGENT', 'HIGH'].includes(t.priority) && TABS.open!.includes(t.status)).length : undefined },
      ]}
      tabs={[
        { key: 'open', label: 'Open' },
        { key: 'waiting', label: 'Waiting on Customer' },
        { key: 'resolved', label: 'Resolved' },
        { key: 'all', label: 'All' },
      ]}
      activeTab={tab}
      basePath="/admin/support"
      search="Search by subject, customer or workspace..."
      liveFilters={{ q }}
      columns={['Subject', 'Customer', 'Category', 'Priority', 'Status', 'Messages', 'Updated']}
      rows={rows.map((t) => [
        <Link key="s" href={`/admin/support/${t.id}`} style={{ color: 'var(--blue)', fontWeight: 700 }}>
          {t.subject}
        </Link>,
        <span key="c">
          {t.user.displayName ?? t.user.email}
          <small style={{ display: 'block', color: 'var(--muted)' }}>{t.workspace.name}</small>
        </span>,
        ticketLabel(t.category),
        ticketLabel(t.priority),
        <StatusPill key="st" tone={TICKET_TONE[t.status] ?? 'slate'}>
          {ticketLabel(t.status)}
        </StatusPill>,
        t._count.messages,
        dateTime(t.updatedAt),
      ])}
      empty={{ icon: <LifeBuoy size={40} />, title: tickets ? 'No requests here' : 'Support requests unavailable', text: tickets ? 'Customer requests appear here.' : 'Your account cannot read support data, or the API is unavailable.' }}
    />
  );
}
