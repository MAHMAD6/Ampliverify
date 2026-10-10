import { Mail } from 'lucide-react';
import { Select } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime, matchesQ, TICKET_TONE, ticketLabel } from '@/lib/admin-data';

export const metadata = { title: 'Contact Messages' };

type Contact = { id: string; name: string; email: string; company: string | null; topic: string; message: string; status: string; handledAt: string | null; createdAt: string };

const TABS: Record<string, string[] | null> = { new: ['OPEN', 'IN_PROGRESS'], handled: ['WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'], all: null };

/** Messages from the website contact form. Reply by email; record the status here. */
export default async function ContactMessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; topic?: string }> }) {
  const { tab = 'new', q, topic } = await searchParams;
  const items = await adminGet<Contact[]>('/admin/contact-submissions');
  const list = items ?? [];
  const rows = list.filter((c) => (!TABS[tab] || TABS[tab]!.includes(c.status)) && (!topic || c.topic === topic) && matchesQ(q, c.name, c.email, c.company, c.message));
  return (
    <AdminList
      section="Support"
      title="Contact Messages"
      description="Messages sent from the website contact form."
      metrics={[
        { label: 'New', icon: <Mail size={24} />, tone: 'blue', value: items ? list.filter((c) => TABS.new!.includes(c.status)).length : undefined },
        { label: 'Handled', icon: <Mail size={24} />, tone: 'green', value: items ? list.filter((c) => TABS.handled!.includes(c.status)).length : undefined },
        { label: 'Sales', icon: <Mail size={24} />, tone: 'purple', value: items ? list.filter((c) => c.topic === 'SALES').length : undefined },
        { label: 'Support', icon: <Mail size={24} />, tone: 'amber', value: items ? list.filter((c) => c.topic === 'SUPPORT').length : undefined },
      ]}
      tabs={[
        { key: 'new', label: 'New' },
        { key: 'handled', label: 'Handled' },
        { key: 'all', label: 'All' },
      ]}
      activeTab={tab}
      basePath="/admin/support/contact"
      search="Search by name, email or message..."
      liveFilters={{ q }}
      selects={[{ label: 'Topic', name: 'topic', value: topic, options: ['All Topics', ...['SALES', 'SUPPORT', 'BILLING', 'PARTNERSHIP', 'PRESS', 'OTHER'].map((t) => [t, ticketLabel(t)] as [string, string])] }]}
      columns={['From', 'Topic', 'Message', 'Received', 'Status']}
      rows={rows.map((c) => [
        <span key="f">
          <b>{c.name}</b>
          <a href={`mailto:${c.email}?subject=${encodeURIComponent('Re: your message to AmpliVerify')}`} style={{ display: 'block', color: 'var(--blue)', fontSize: 13 }}>
            {c.email}
          </a>
          {c.company && <small style={{ color: 'var(--muted)' }}>{c.company}</small>}
        </span>,
        ticketLabel(c.topic),
        <details key="m" style={{ maxWidth: 420 }}>
          <summary style={{ cursor: 'pointer' }}>{c.message.slice(0, 80)}{c.message.length > 80 ? '…' : ''}</summary>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{c.message}</p>
        </details>,
        dateTime(c.createdAt),
        <span key="s" style={{ display: 'grid', gap: 6 }}>
          <StatusPill tone={TICKET_TONE[c.status] ?? 'slate'}>{ticketLabel(c.status)}</StatusPill>
          <ApiForm method="PATCH" path={`/admin/contact-submissions/${c.id}`} submitLabel="Set" successMessage={null}>
            <Select name="status" defaultValue={c.status} aria-label="Status">
              {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
                <option key={st} value={st}>
                  {ticketLabel(st)}
                </option>
              ))}
            </Select>
          </ApiForm>
        </span>,
      ])}
      empty={{ icon: <Mail size={40} />, title: items ? 'No messages here' : 'Messages unavailable', text: items ? 'Website contact form messages appear here.' : 'Your account cannot read contact messages, or the API is unavailable.' }}
    />
  );
}
