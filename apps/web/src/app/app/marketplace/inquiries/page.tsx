import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Badge, Field, PageHeader, Panel, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Inquiry } from '@/lib/marketplace';
import s from '@/components/app/marketplace/market.module.css';

export const metadata = { title: 'My Inquiries · Marketplace' };

const STATUS: Record<Inquiry['status'], { label: string; tone?: 'blue' | 'green' | 'amber' }> = { OPEN: { label: 'Awaiting reply', tone: 'amber' }, REPLIED: { label: 'Replied', tone: 'green' }, CLOSED: { label: 'Closed' } };

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const role = (await searchParams).role === 'sent' ? 'sent' : 'received';
  const res = await apiGet<Inquiry[]>(`/user/marketplace/my/inquiries?role=${role}`, { auth: true });
  const rows = res.ok ? res.data : [];
  return (
    <>
      <PageHeader title="My Inquiries" description="Questions buyers asked about your listings, and the ones you sent to sellers." />
      <nav aria-label="Inquiry type" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['received', 'sent'] as const).map((r) => (
          <Link key={r} href={`/app/marketplace/inquiries${r === 'sent' ? '?role=sent' : ''}`} aria-current={role === r ? 'page' : undefined} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--line)', background: role === r ? '#ecfdf5' : 'var(--surface)', color: role === r ? '#047857' : 'var(--text)' }}>
            {r === 'received' ? 'Received (as seller)' : 'Sent (as buyer)'}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Panel>
          <StateView
            kind={res.ok ? 'empty' : 'error'}
            icon={<MessageSquare size={36} />}
            title={!res.ok ? 'Inquiries could not be loaded' : role === 'received' ? 'No inquiries received yet' : 'You have not contacted any sellers'}
            description={!res.ok ? 'Please try again shortly.' : role === 'received' ? 'When buyers ask about your live listings, their questions appear here.' : 'Open a listing in Browse Digital Assets to ask the seller a question.'}
          />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {rows.map((q) => (
            <Panel
              key={q.id}
              title={
                q.listing ? (
                  <Link href={`/app/marketplace/browse/${q.listing.id}`} style={{ color: 'var(--blue)' }}>
                    {q.listing.title}
                  </Link>
                ) : (
                  'Listing'
                )
              }
              actions={<Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>}
            >
              <div className={s.thread}>
                <div className={s.bubble}>
                  <small>
                    {role === 'received' ? q.from : 'You'} · {formatDateTime(q.createdAt)}
                  </small>
                  {q.message}
                </div>
                {q.reply && (
                  <div className={`${s.bubble} ${s.bubbleReply}`}>
                    <small>
                      {role === 'received' ? 'You' : 'Seller'} · {formatDateTime(q.repliedAt)}
                    </small>
                    {q.reply}
                  </div>
                )}
                {role === 'received' && q.status !== 'CLOSED' && (
                  <ApiForm path={`/user/marketplace/inquiries/${q.id}/reply`} submitLabel={q.reply ? 'Update Reply' : 'Send Reply'} successMessage="Reply sent." resetOnSuccess>
                    <Field label="Your reply" htmlFor={`r-${q.id}`}>
                      <Textarea id={`r-${q.id}`} name="message" required minLength={2} maxLength={4000} rows={3} />
                    </Field>
                  </ApiForm>
                )}
                {q.status !== 'CLOSED' && (
                  <div>
                    <ActionButton size="sm" variant="ghost" path={`/user/marketplace/inquiries/${q.id}/close`} confirm="Close this inquiry?" successMessage="Inquiry closed.">
                      Close inquiry
                    </ActionButton>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
