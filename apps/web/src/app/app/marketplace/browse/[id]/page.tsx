import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { Badge, Field, KeyValue, Notice, PageHeader, Panel, Textarea } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { assetLabel, LISTING_STATUS, type ListingDetail, money } from '@/lib/marketplace';
import { getAppContext } from '@/lib/project';
import s from '@/components/app/marketplace/market.module.css';

export const metadata = { title: 'Listing · Marketplace' };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, ctx] = await Promise.all([apiGet<ListingDetail>(`/user/marketplace/listings/${encodeURIComponent(id)}`, { auth: true }), getAppContext()]);
  if (!res.ok) notFound();
  const l = res.data;
  const status = l.status ? LISTING_STATUS[l.status] : null;
  return (
    <>
      <PageHeader title={l.title} description={l.summary} crumbs={[{ label: 'Marketplace', href: '/app/marketplace' }, { label: 'Browse', href: '/app/marketplace/browse' }, { label: l.title }]} />
      <div className={s.two}>
        <Panel title="About this asset">
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 15, lineHeight: 1.6 }}>{l.description}</p>
          <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--muted)' }}>Figures are reported by the seller and have not been verified by AmpliVerify. Do your own due diligence before buying.</p>
        </Panel>
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel>
            <span className={s.price} style={{ fontSize: 26 }}>
              {money(l.askingPriceMinor, l.currency)}
            </span>
            <div style={{ marginTop: 8 }}>
              <KeyValue label="Type" value={<Badge tone="green">{assetLabel(l.assetType)}</Badge>} />
              {l.url && (
                <KeyValue
                  label="Website"
                  value={
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--blue)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      {l.url.replace(/^https:\/\//, '')} <ExternalLink size={14} aria-hidden />
                    </a>
                  }
                />
              )}
              <KeyValue label="Monthly revenue" value={l.monthlyRevenueMinor !== null ? `${money(l.monthlyRevenueMinor, l.currency)} (seller-reported)` : 'Not provided'} />
              <KeyValue label="Monthly visitors" value={l.monthlyVisitors !== null ? `${l.monthlyVisitors.toLocaleString('en-US')} (seller-reported)` : 'Not provided'} />
              {l.publishedAt && <KeyValue label="Listed" value={formatDate(l.publishedAt)} />}
              {status && <KeyValue label="Status" value={<Badge tone={status.tone}>{status.label}</Badge>} />}
            </div>
          </Panel>
          {l.own ? (
            <Notice tone={l.status === 'REJECTED' ? 'amber' : 'neutral'} title="This is your listing.">
              {l.status === 'REJECTED' && l.reviewNote ? `Review note: ${l.reviewNote}` : 'Buyers contact you through inquiries; you will see them under My Inquiries.'}
            </Notice>
          ) : l.myInquiry && l.myInquiry.status !== 'CLOSED' ? (
            <Panel title="Your inquiry">
              <div className={s.thread}>
                <div className={s.bubble}>
                  <small>You · {formatDateTime(l.myInquiry.createdAt)}</small>
                  {l.myInquiry.message}
                </div>
                {l.myInquiry.reply ? (
                  <div className={`${s.bubble} ${s.bubbleReply}`}>
                    <small>Seller · {formatDateTime(l.myInquiry.repliedAt)}</small>
                    {l.myInquiry.reply}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Waiting for the seller to reply. We will notify you.</p>
                )}
              </div>
            </Panel>
          ) : !ctx.workspaceId ? (
            <Notice tone="neutral">Create a workspace first to contact sellers.</Notice>
          ) : (
            <Panel title="Contact the seller" description="Ask about the asset. Your email address is not shared with the seller.">
              <ApiForm path={`/user/marketplace/listings/${l.id}/inquiries`} extra={{ workspaceId: ctx.workspaceId }} submitLabel="Send Inquiry" successMessage="Inquiry sent. The seller will be notified." resetOnSuccess>
                <Field label="Message" htmlFor="inq">
                  <Textarea id="inq" name="message" required minLength={10} maxLength={4000} rows={5} placeholder="What would you like to know? E.g. traffic sources, how revenue is earned, what is included." />
                </Field>
              </ApiForm>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' }}>Purchases are not completed in AmpliVerify yet. Never send payment outside a verified escrow process.</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
