import Link from 'next/link';
import { CircleHelp, Search } from 'lucide-react';
import { Badge, ButtonLink, EmptyState, Field, Grid, Input, KeyValue, PageHeader, Panel, Select, Textarea } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';

export const metadata = { title: 'Help & Support' };

const SHORTCUTS = [
  ['Getting Started', 'getting started'],
  ['SEO Audits', 'audit'],
  ['Reports', 'report'],
  ['Billing & Credits', 'billing'],
];

type Ticket = { id: string; subject: string; category: string; status: string; createdAt: string; updatedAt: string; _count: { messages: number } };
type TicketDetail = Ticket & { messages: { id: string; body: string; isStaff: boolean; createdAt: string; author: { displayName: string | null; email: string } | null }[] };

/** Help & Support: search the help center, open support requests and follow replies. */
export default async function HelpSupportPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const { ticket } = await searchParams;
  const { workspaceId } = await getAppContext();
  const [listRes, detailRes] = await Promise.all([
    workspaceId ? apiGet<Ticket[]>(`/user/support-tickets?workspaceId=${workspaceId}`, { auth: true }) : null,
    ticket ? apiGet<TicketDetail>(`/user/support-tickets/${encodeURIComponent(ticket)}`, { auth: true }) : null,
  ]);
  const tickets = listRes?.ok ? listRes.data : [];
  const detail = detailRes?.ok ? detailRes.data : null;
  return (
    <>
      <PageHeader title="Help & Support" description="Find product guidance or contact support when you need assistance." crumbs={appCrumbs({ label: 'Help & Support' })} />
      <Grid cols={2}>
        <Panel title="Find an Answer" description="Search product guidance before opening a support request." flushHead>
          <form action="/help">
            <Field label="Search help" htmlFor="help-q">
              <Input id="help-q" name="q" icon={<Search size={18} />} placeholder="Search audits, projects, reports, billing, GEO, editor, or settings..." />
            </Field>
          </form>
          <Grid cols={2}>
            {SHORTCUTS.map(([label, q]) => (
              <ButtonLink key={label} href={`/help?q=${encodeURIComponent(q)}`} variant="secondary" block>
                {label}
              </ButtonLink>
            ))}
          </Grid>
        </Panel>
        <Panel title="Contact Support" description="Send a request when documentation does not resolve the issue." flushHead>
          {workspaceId ? (
            <ApiForm path="/user/support-tickets" submitLabel="Submit Support Request" transform={(v) => ({ ...v, workspaceId })} resetOnSuccess successMessage="Request sent. We’ll reply here and by email.">
              <Field label="Topic" htmlFor="s-topic">
                <Select id="s-topic" name="category" defaultValue="GENERAL">
                  <option value="GENERAL">General question</option>
                  <option value="TECHNICAL">Technical issue</option>
                  <option value="BUG">Something is broken</option>
                  <option value="BILLING">Billing & credits</option>
                  <option value="ACCOUNT">Account & access</option>
                  <option value="FEATURE_REQUEST">Feature request</option>
                </Select>
              </Field>
              <Field label="Priority" htmlFor="s-priority">
                <Select id="s-priority" name="priority" defaultValue="NORMAL">
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </Field>
              <Field label="Subject" htmlFor="s-subject">
                <Input id="s-subject" name="subject" required minLength={3} maxLength={200} placeholder="Describe the issue briefly" />
              </Field>
              <Field label="Message" htmlFor="s-message">
                <Textarea id="s-message" name="message" required minLength={10} maxLength={5000} placeholder="Explain what happened, what you expected, and any relevant project or page." />
              </Field>
            </ApiForm>
          ) : (
            <EmptyState compact icon={<CircleHelp size={22} />} title="Sign in to contact support" description="Support requests are linked to your workspace." />
          )}
        </Panel>
        <Panel title="Useful Links" flushHead>
          <KeyValue label="Documentation" value={<Link href="/help" style={{ color: 'var(--blue)' }}>Open Help Center</Link>} />
          <KeyValue label="Account & Billing" value={<Link href="/app/billing" style={{ color: 'var(--blue)' }}>Open Billing & Plan</Link>} />
          <KeyValue label="Privacy" value={<Link href="/legal#privacy" style={{ color: 'var(--blue)' }}>Open privacy information</Link>} />
        </Panel>
        <Panel title="Your Requests" description="Requests you submitted and their status." flushHead>
          {tickets.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {tickets.map((t) => (
                <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
                  <Link href={`/app/help?ticket=${t.id}`} style={{ color: 'var(--blue)' }}>
                    {t.subject}
                  </Link>
                  <span>
                    <Badge tone={t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'green' : t.status === 'WAITING_ON_CUSTOMER' ? 'amber' : 'blue'}>{humanize(t.status)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CircleHelp size={22} />} title="No support requests yet" description="Submitted requests and their status will appear here." />
          )}
        </Panel>
      </Grid>
      {detail && (
        <Panel title={detail.subject} description={`${humanize(detail.category)} · ${humanize(detail.status)} · opened ${formatDateTime(detail.createdAt)}`} flushHead>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {detail.messages.map((m) => (
              <li key={m.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: m.isStaff ? 'var(--blue-50, #eff6ff)' : undefined }}>
                <small style={{ color: 'var(--muted)' }}>
                  {m.isStaff ? 'AmpliVerify Support' : m.author?.displayName ?? m.author?.email ?? 'You'} · {formatDateTime(m.createdAt)}
                </small>
                <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
              </li>
            ))}
          </ul>
          {detail.status !== 'CLOSED' && (
            <ApiForm path={`/user/support-tickets/${detail.id}/messages`} submitLabel="Send Reply" resetOnSuccess successMessage="Reply sent.">
              <Field label="Reply" htmlFor="reply">
                <Textarea id="reply" name="body" required maxLength={5000} />
              </Field>
            </ApiForm>
          )}
        </Panel>
      )}
    </>
  );
}
