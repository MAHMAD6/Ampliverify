import { Mail } from 'lucide-react';
import { ButtonLink, DataTable, EmptyState, Notice, Panel, TabNav } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime } from '@/lib/admin-data';

export const metadata = { title: 'Newsletter' };

type Row = { id: string; email: string; status: 'PENDING' | 'SUBSCRIBED' | 'UNSUBSCRIBED'; source: string | null; createdAt: string; confirmedAt: string | null; unsubscribedAt: string | null };
const STATUSES = ['SUBSCRIBED', 'PENDING', 'UNSUBSCRIBED'] as const;
const TONE = { SUBSCRIBED: 'green', PENDING: 'amber', UNSUBSCRIBED: 'slate' } as const;
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Double opt-in newsletter list from the website sign-up forms. */
export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'SUBSCRIBED' } = await searchParams;
  const current = (STATUSES as readonly string[]).includes(status) ? status : 'SUBSCRIBED';
  const data = await adminGet<{ counts: Record<string, number>; rows: Row[] }>(`/admin/newsletter?status=${current}`);
  return (
    <>
      <AdminHeader
        section="Content Management"
        title="Newsletter"
        description="Website sign-ups. People are added as Subscribed only after confirming by email."
        actions={
          <ButtonLink href="/admin/newsletter/export" variant="outline" icon={<Mail size={16} />}>
            Export Subscribed (CSV)
          </ButtonLink>
        }
      />
      <TabNav active={current} tabs={STATUSES.map((s) => ({ key: s, label: `${label(s)} (${data?.counts[s] ?? 0})`, href: `/admin/newsletter?status=${s}` }))} />
      <Panel bodyless>
        {!data ? (
          <div style={{ padding: 20 }}>
            <Notice tone="neutral">The list could not be loaded with your permissions.</Notice>
          </div>
        ) : data.rows.length === 0 ? (
          <EmptyState icon={<Mail size={28} />} title={`No ${label(current).toLowerCase()} addresses`} description="Sign-up forms are on the Blog, Guides and article pages." />
        ) : (
          <DataTable
            columns={['Email', 'Status', 'Source', 'Signed up', 'Confirmed', '']}
            rows={data.rows.map((r) => [
              r.email,
              <StatusPill key="s" tone={TONE[r.status]}>
                {label(r.status)}
              </StatusPill>,
              r.source ?? '—',
              dateTime(r.createdAt),
              r.confirmedAt ? dateTime(r.confirmedAt) : '—',
              <ActionButton key="d" size="sm" variant="ghost" method="DELETE" path={`/admin/newsletter/${r.id}`} confirm={`Delete ${r.email} from the list permanently?`} revalidate={['/admin/newsletter']}>
                Delete
              </ActionButton>,
            ])}
          />
        )}
      </Panel>
    </>
  );
}
