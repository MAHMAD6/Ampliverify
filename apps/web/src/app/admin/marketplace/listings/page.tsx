import { Store } from 'lucide-react';
import { DataTable, Field, Input, KeyValue, PageHeader, Panel } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { AdminMarketNav } from '@/components/admin/market/AdminMarketNav';
import { Pills, StatusBadge } from '@/components/market/parts';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { assetLabel, CHECK_KIND, CHECK_STATUS, fileSize, kindLabel, LISTING_STATUS, type ListingStatus, money, type OwnListing } from '@/lib/marketplace';

export const metadata = { title: 'Listing Review & Moderation · Admin' };

type AdminListing = Omit<OwnListing, 'files'> & {
  description: string;
  licenseTerms: string | null;
  aiDisclosure: string | null;
  seller: { email: string; displayName: string | null; profileId: string | null; identity: string; business: string };
  files: { id: string; role: string; filename: string; sizeBytes: number }[];
  checks: { id: string; kind: string; status: string }[];
};
const FILTERS: (ListingStatus | 'ALL')[] = ['PENDING_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'REJECTED', 'WITHDRAWN', 'SOLD', 'ALL'];

/** Every listing needs a human decision; nothing is approved automatically (V2 guide §1). */
export default async function AdminListingReview({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = (FILTERS as string[]).includes(sp.status ?? '') ? (sp.status as ListingStatus | 'ALL') : 'PENDING_REVIEW';
  const rows = await adminGet<AdminListing[]>(`/admin/marketplace/listings${status === 'ALL' ? '' : `?status=${status}`}`);
  return (
    <>
      <PageHeader title="Listing Review & Moderation" description="Approve, request changes or reject. The seller sees your note. A listing is published only after the seller's identity is approved." />
      <AdminMarketNav active="listings" />
      <Pills items={FILTERS.map((f) => ({ key: f, label: f === 'ALL' ? 'All' : (LISTING_STATUS[f]?.label ?? f), href: `/admin/marketplace/listings?status=${f}` }))} active={status} label="Status" />
      <div style={{ marginTop: 14 }}>
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
              <Panel key={l.id} title={l.title} description={`${kindLabel(l.kind)} · ${assetLabel(l.assetType)} · ${money(l.askingPriceMinor, l.currency)} · ${l.seller.displayName ?? ''} <${l.seller.email}> · submitted ${formatDateTime(l.submittedAt ?? l.updatedAt)}`} actions={<StatusBadge map={LISTING_STATUS} value={l.status} />}>
                <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{l.summary}</p>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{l.description}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
                  <div>
                    <KeyValue label="Website" value={l.url ?? '—'} />
                    <KeyValue label="Monthly revenue" value={money(l.monthlyRevenueMinor, l.currency)} />
                    <KeyValue label="Monthly visitors" value={l.monthlyVisitors?.toLocaleString('en-US') ?? '—'} />
                    <KeyValue label="AI-generated" value={l.aiGenerated ? `Yes${l.aiDisclosure ? `: ${l.aiDisclosure}` : ''}` : 'No'} />
                  </div>
                  <div>
                    <KeyValue label="Seller identity" value={<StatusBadge map={CHECK_STATUS} value={l.seller.identity} />} />
                    <KeyValue label="Seller business" value={<StatusBadge map={CHECK_STATUS} value={l.seller.business} />} />
                    {l.checks.map((c) => (
                      <KeyValue key={c.id} label={`${CHECK_KIND[c.kind] ?? c.kind} check`} value={<StatusBadge map={CHECK_STATUS} value={c.status} />} />
                    ))}
                  </div>
                </div>
                {l.licenseTerms && <p style={{ margin: '10px 0 0', fontSize: 13 }}><b>Licence:</b> {l.licenseTerms}</p>}
                {l.files.length > 0 && (
                  <DataTable columns={['File', 'Role', 'Size']} rows={l.files.map((f) => [f.filename, f.role === 'MEDIA' ? 'Media' : 'Deliverable', fileSize(f.sizeBytes)])} />
                )}
                {l.reviewNote && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>Review note: {l.reviewNote}</p>}
                {l.status === 'PENDING_REVIEW' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginTop: 12 }}>
                    <ActionButton path={`/admin/marketplace/listings/${l.id}/review`} body={{ decision: 'APPROVE' }} confirm={`Publish “${l.title}”?`} successMessage="Listing approved and published.">
                      Approve & Publish
                    </ActionButton>
                    <div style={{ flex: '1 1 300px' }}>
                      <ApiForm path={`/admin/marketplace/listings/${l.id}/review`} extra={{ decision: 'REQUEST_CHANGES' }} submitLabel="Request changes" submitVariant="outline" successMessage="Changes requested; the seller was notified.">
                        <Field label="What should the seller change?" htmlFor={`rc-${l.id}`}>
                          <Input id={`rc-${l.id}`} name="note" required maxLength={1000} />
                        </Field>
                      </ApiForm>
                    </div>
                    <div style={{ flex: '1 1 300px' }}>
                      <ApiForm path={`/admin/marketplace/listings/${l.id}/review`} extra={{ decision: 'REJECT' }} submitLabel="Reject" submitVariant="outline" successMessage="Listing rejected; the seller was notified.">
                        <Field label="Reason for rejection" htmlFor={`rj-${l.id}`}>
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
      </div>
    </>
  );
}
