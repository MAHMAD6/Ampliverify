import { notFound } from 'next/navigation';
import { Field, KeyValue, Panel, Select, Textarea } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime, TICKET_TONE, ticketLabel } from '@/lib/admin-data';

export const metadata = { title: 'Support Request' };

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  user: { id: string; email: string; displayName: string | null };
  workspace: { id: string; name: string };
  messages: { id: string; body: string; isStaff: boolean; createdAt: string; author: { displayName: string | null; email: string } | null }[];
};

const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'];

/** One support request: the conversation, a staff reply (notifies the customer) and status. */
export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await adminGet<Ticket>(`/admin/support-tickets/${encodeURIComponent(id)}`);
  if (!t) notFound();
  return (
    <>
      <AdminHeader section="Support" parent={{ label: 'Support Requests', href: '/admin/support' }} page={t.subject} title={t.subject} description={`${ticketLabel(t.category)} · ${ticketLabel(t.priority)} priority · opened ${dateTime(t.createdAt)}`} />
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }}>
        <Panel title="Conversation">
          <div style={{ display: 'grid', gap: 12 }}>
            {t.messages.map((m) => (
              <div key={m.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', background: m.isStaff ? 'var(--blue-50)' : '#fff' }}>
                <small style={{ color: 'var(--muted)' }}>
                  <b style={{ color: 'var(--heading)' }}>{m.isStaff ? `${m.author?.displayName ?? m.author?.email ?? 'Staff'} (AmpliVerify)` : (m.author?.displayName ?? m.author?.email ?? 'Customer')}</b> · {dateTime(m.createdAt)}
                </small>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 6, fontSize: 14 }}>{m.body}</p>
              </div>
            ))}
          </div>
          {t.status !== 'CLOSED' && (
            <div style={{ marginTop: 16 }}>
              <ApiForm path={`/admin/support-tickets/${t.id}/messages`} submitLabel="Send Reply" resetOnSuccess successMessage="Reply sent; the customer was notified.">
                <Field label="Reply" htmlFor="tr-body">
                  <Textarea id="tr-body" name="body" required rows={4} maxLength={5000} />
                </Field>
                <Field label="Then set status to" htmlFor="tr-status">
                  <Select id="tr-status" name="status" defaultValue="WAITING_ON_CUSTOMER">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ticketLabel(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </ApiForm>
            </div>
          )}
        </Panel>
        <Panel title="Details" flushHead>
          <KeyValue label="Status" value={<StatusPill tone={TICKET_TONE[t.status] ?? 'slate'}>{ticketLabel(t.status)}</StatusPill>} />
          <KeyValue label="Customer" value={<a href={`/admin/users/${t.user.id}`} style={{ color: 'var(--blue)' }}>{t.user.displayName ?? t.user.email}</a>} />
          <KeyValue label="Email" value={t.user.email} />
          <KeyValue label="Workspace" value={t.workspace.name} />
          <div style={{ marginTop: 12 }}>
            <ApiForm method="PATCH" path={`/admin/support-tickets/${t.id}`} submitLabel="Change Status" successMessage="Status updated.">
              <Select name="status" defaultValue={t.status} aria-label="Status">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ticketLabel(s)}
                  </option>
                ))}
              </Select>
            </ApiForm>
          </div>
        </Panel>
      </div>
    </>
  );
}
