import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { EmptyState, Notice, Panel, TabNav } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime } from '@/lib/admin-data';

export const metadata = { title: 'Comments' };

type Row = { id: string; contentType: string; authorName: string; authorEmail: string; body: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SPAM'; createdAt: string; article: { title: string; slug: string; base: string } | null };
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SPAM'] as const;
const TONE = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'slate', SPAM: 'red' } as const;
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Reader comments on blog posts and guides. Nothing is public until approved. */
export default async function CommentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'PENDING' } = await searchParams;
  const current = (STATUSES as readonly string[]).includes(status) ? status : 'PENDING';
  const data = await adminGet<{ counts: Record<string, number>; rows: Row[] }>(`/admin/comments?status=${current}`);
  return (
    <>
      <AdminHeader section="Content Management" title="Comments" description="Moderate reader comments on blog posts and guides. Comments appear on the site only after approval." />
      <TabNav active={current} tabs={STATUSES.map((s) => ({ key: s, label: `${label(s)} (${data?.counts[s] ?? 0})`, href: `/admin/comments?status=${s}` }))} />
      <Panel bodyless>
        {!data ? (
          <div style={{ padding: 20 }}>
            <Notice tone="neutral">Comments could not be loaded with your permissions.</Notice>
          </div>
        ) : data.rows.length === 0 ? (
          <EmptyState icon={<MessageSquare size={28} />} title={`No ${label(current).toLowerCase()} comments`} description="Comments are enabled per article in the editor (Allow Comments)." />
        ) : (
          <div style={{ display: 'grid' }}>
            {data.rows.map((c) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, padding: '16px 20px', borderTop: '1px solid var(--line)' }}>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{c.authorName}</b>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>{c.authorEmail}</span>
                    <StatusPill tone={TONE[c.status]}>{label(c.status)}</StatusPill>
                  </div>
                  <p style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                  <small style={{ color: 'var(--muted)' }}>
                    {dateTime(c.createdAt)} · on{' '}
                    {c.article ? (
                      <Link href={`${c.article.base}/${c.article.slug}`} target="_blank" style={{ color: 'var(--blue)' }}>
                        {c.article.title}
                      </Link>
                    ) : (
                      'a deleted article'
                    )}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {c.status !== 'APPROVED' && (
                    <ActionButton size="sm" method="PATCH" path={`/admin/comments/${c.id}`} body={{ status: 'APPROVED' }} revalidate={['/admin/comments']}>
                      Approve
                    </ActionButton>
                  )}
                  {c.status !== 'REJECTED' && (
                    <ActionButton size="sm" variant="outline" method="PATCH" path={`/admin/comments/${c.id}`} body={{ status: 'REJECTED' }} revalidate={['/admin/comments']}>
                      Reject
                    </ActionButton>
                  )}
                  {c.status !== 'SPAM' && (
                    <ActionButton size="sm" variant="ghost" method="PATCH" path={`/admin/comments/${c.id}`} body={{ status: 'SPAM' }} revalidate={['/admin/comments']}>
                      Spam
                    </ActionButton>
                  )}
                  <ActionButton size="sm" variant="ghost" method="DELETE" path={`/admin/comments/${c.id}`} confirm="Delete this comment permanently?" revalidate={['/admin/comments']}>
                    Delete
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
