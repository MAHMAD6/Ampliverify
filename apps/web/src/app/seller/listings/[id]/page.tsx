import { notFound } from 'next/navigation';
import { Eye, Handshake, Heart, MessageSquare, ShoppingBag } from 'lucide-react';
import { ButtonLink, DataTable, Field, Grid, Input, Metric, Notice, PageHeader, Panel } from '@/components/ui';
import { ActionButton, UploadForm } from '@/components/ui/actions';
import { ListingForm } from '@/components/market/ListingForm';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { fileSize, LISTING_STATUS, type MyListingDetail } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Manage Listing · Marketplace' };

const SUBMITTABLE = ['DRAFT', 'CHANGES_REQUESTED', 'REJECTED', 'WITHDRAWN'];

export default async function ManageListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<MyListingDetail>(`/user/marketplace/my/listings/${id}`, { auth: true });
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This listing" />;
  const l = res.data;
  const locked = l.status === 'SOLD';
  const media = l.files.filter((f) => f.role === 'MEDIA');
  const deliverables = l.files.filter((f) => f.role === 'DELIVERABLE');
  const fileRows = (rows: typeof l.files) =>
    rows.map((f) => [
      f.filename,
      f.contentType,
      fileSize(f.sizeBytes),
      formatDateTime(f.createdAt),
      locked ? '' : (
        <ActionButton key="d" method="DELETE" path={`/user/marketplace/my/listings/${l.id}/files/${f.id}`} size="sm" variant="ghost" confirm={`Remove ${f.filename}?`} successMessage="File removed.">
          Remove
        </ActionButton>
      ),
    ]);
  return (
    <>
      <PageHeader
        title={l.title}
        description={l.submittedAt ? `Submitted ${formatDateTime(l.submittedAt)}` : `Created ${formatDateTime(l.createdAt)}`}
        crumbs={[{ label: 'My Listings', href: '/seller/listings' }, { label: l.title }]}
        actions={
          <div className={m.actions}>
            <StatusBadge map={LISTING_STATUS} value={l.status} />
            <ButtonLink href={`/buyer/listings/${l.id}`} variant="outline" size="sm">
              Preview
            </ButtonLink>
          </div>
        }
      />
      {l.reviewNote && (l.status === 'CHANGES_REQUESTED' || l.status === 'REJECTED') && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="amber" title={l.status === 'CHANGES_REQUESTED' ? 'Changes requested by our review team' : 'Not approved'}>
            {l.reviewNote}
          </Notice>
        </div>
      )}
      <Grid cols={4}>
        <Metric label="Views" value={l.analytics.views} icon={<Eye size={20} />} tone="blue" />
        <Metric label="Saves" value={l.analytics.saves} icon={<Heart size={20} />} tone="red" />
        <Metric label="Inquiries" value={l.analytics.inquiries} icon={<MessageSquare size={20} />} tone="green" />
        <Metric label={l.kind === 'DIGITAL_PRODUCT' ? 'Sales' : 'Offers'} value={l.kind === 'DIGITAL_PRODUCT' ? l.analytics.sales : l.analytics.offers} icon={l.kind === 'DIGITAL_PRODUCT' ? <ShoppingBag size={20} /> : <Handshake size={20} />} tone="purple" />
      </Grid>
      <div className={m.stack} style={{ marginTop: 16 }}>
        <Panel title="Publishing">
          <div className={m.actions}>
            {SUBMITTABLE.includes(l.status) && (
              <ActionButton path={`/user/marketplace/my/listings/${l.id}/submit`} confirm="Submit this listing for review?" successMessage="Submitted. Our team will review it.">
                Submit for review
              </ActionButton>
            )}
            {(l.status === 'PUBLISHED' || l.status === 'PENDING_REVIEW') && (
              <ActionButton method="PATCH" path={`/user/marketplace/my/listings/${l.id}`} body={{ withdraw: true }} variant="outline" confirm="Withdraw this listing? Buyers will no longer see it." successMessage="Listing withdrawn.">
                Withdraw listing
              </ActionButton>
            )}
            {l.status === 'DRAFT' && (
              <ActionButton method="DELETE" path={`/user/marketplace/my/listings/${l.id}`} variant="ghost" confirm="Delete this draft and its files permanently?" redirectTo="/seller/listings" successMessage="Draft deleted.">
                Delete draft
              </ActionButton>
            )}
          </div>
          <p className={m.muted} style={{ marginBottom: 0 }}>
            {l.status === 'PENDING_REVIEW' ? 'In review. You will be notified of the decision.' : l.status === 'PUBLISHED' ? 'Live. Edits or new files send the listing back to review.' : l.status === 'SOLD' ? 'Sold listings are final.' : 'Not visible to buyers.'}
          </p>
        </Panel>
        <Panel title="Images and videos" description="PNG, JPEG, GIF, WebP, MP4 or WebM, up to 50 MB each. The first image is the cover.">
          <DataTable columns={['File', 'Type', 'Size', 'Added', '']} rows={fileRows(media)} empty="No media yet." />
          {!locked && (
            <div style={{ marginTop: 12 }}>
              <UploadForm path={`/user/marketplace/my/listings/${l.id}/files`} submitLabel="Upload media">
                <input type="hidden" name="role" value="MEDIA" />
                <Field label="Choose a file" htmlFor="up-media">
                  <Input id="up-media" name="file" type="file" required accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm" />
                </Field>
              </UploadForm>
            </div>
          )}
        </Panel>
        {l.kind === 'DIGITAL_PRODUCT' && (
          <Panel title="Files the buyer receives" description="Delivered only after payment is confirmed, through short-lived download links. PDF, ZIP, Word, image or video, up to 50 MB each.">
            <DataTable columns={['File', 'Type', 'Size', 'Added', '']} rows={fileRows(deliverables)} empty="No deliverable files yet. Add at least one before submitting." />
            {!locked && (
              <div style={{ marginTop: 12 }}>
                <UploadForm path={`/user/marketplace/my/listings/${l.id}/files`} submitLabel="Upload file">
                  <input type="hidden" name="role" value="DELIVERABLE" />
                  <Field label="Choose a file" htmlFor="up-deliv">
                    <Input id="up-deliv" name="file" type="file" required />
                  </Field>
                </UploadForm>
              </div>
            )}
          </Panel>
        )}
        {!locked && <ListingForm listing={l} />}
      </div>
    </>
  );
}
