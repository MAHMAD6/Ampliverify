import Link from 'next/link';
import { Store } from 'lucide-react';
import { Badge, DataTable, Field, Input, PageHeader, Panel } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { assetLabel, LISTING_STATUS, type ListingStatus, money, type OwnListing } from '@/lib/marketplace';

export const metadata = { title: 'Marketplace Listing Review · Admin' };

type AdminListing = OwnListing & { description: string; seller: { email: string; displayName: string | null } };
const FILTERS: (ListingStatus | 'ALL')[] = ['PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'WITHDRAWN', 'SOLD', 'ALL'];

export default async function AdminMarketplacePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = (FILTERS as string[]).includes(sp.status ?? '') ? (sp.status as ListingStatus | 'ALL') : 'PENDING_REVIEW';
  const rows = (await adminGet<AdminListing[]>(`/admin/marketplace/listings${status === 'ALL' ? '' : `?status=${status}`}`)) ?? null;
  return (
    <>
      <PageHeader title="Marketplace Listing Review" description="Approve listings before buyers can see them. Rejections need a reason, which the seller sees." />
      <nav aria-label="Status" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/marketplace?status=${f}`} aria-current={status === f ? 'page' : undefined} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--line)', background: status === f ? 'var(--navy-950, #0b1f44)' : 'var(--surface)', color: status === f ? '#fff' : 'var(--text)' }}>
            {f === 'ALL' ? 'All' : LISTING_STATUS[f].label}
          </Link>
        ))}
      </nav>
      {!rows ? (
        <Panel>
          <StateView kind="error" title="Listings could not be loaded with your permissions." />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <StateView kind="empty" icon={<Store size={36} />} title="Nothing here" description={status === 'PENDING_REVIEW' ? 'No listings are waiting for review.' : 'No listings with this status.'} />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {rows.map((l) => (
            <Panel key={l.id} title={l.title} description={`${assetLabel(l.assetType)} · ${money(l.askingPriceMinor, l.currency)} · ${l.seller.displayName ?? ''} <${l.seller.email}> · submitted ${formatDateTime(l.updatedAt)}`} actions={<Badge tone={LISTING_STATUS[l.status].tone}>{LISTING_STATUS[l.status].label}</Badge>}>
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{l.summary}</p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{l.description}</p>
              <DataTable
                columns={['Website', 'Monthly revenue', 'Monthly visitors']}
                rows={[[l.url ?? '—', money(l.monthlyRevenueMinor, l.currency), l.monthlyVisitors?.toLocaleString('en-US') ?? '—']]}
              />
              {l.reviewNote && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>Review note: {l.reviewNote}</p>}
              {l.status === 'PENDING_REVIEW' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginTop: 12 }}>
                  <ActionButton path={`/admin/marketplace/listings/${l.id}/review`} body={{ decision: 'APPROVE' }} confirm={`Publish “${l.title}”?`} successMessage="Listing approved and published.">
                    Approve & Publish
                  </ActionButton>
                  <div style={{ flex: '1 1 320px' }}>
                    <ApiForm path={`/admin/marketplace/listings/${l.id}/review`} extra={{ decision: 'REJECT' }} submitLabel="Reject" submitVariant="outline" successMessage="Listing rejected; the seller was notified.">
                      <Field label="Reason for rejection (shown to the seller)" htmlFor={`rj-${l.id}`}>
                        <Input id={`rj-${l.id}`} name="note" required maxLength={1000} />
                      </Field>
                    </ApiForm>
                  </div>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
