import Link from 'next/link';
import type { ReactNode } from 'react';
import { BadgeCheck, Lock, ShieldCheck } from 'lucide-react';
import { Badge, ButtonLink, Field, Input, KeyValue, Notice, PageHeader, Panel, Textarea, type Crumb } from '../ui';
import { ApiForm } from '../ui/actions';
import { formatDate } from '@/lib/format';
import { assetLabel, fileSize, kindLabel, type ListingDetail, LISTING_STATUS, type MarketMeta, mediaSrc, money } from '@/lib/marketplace';
import { SaveButton } from './forms';
import { StatusBadge } from './parts';
import m from './market.module.css';

/**
 * Listing details, shared by the public Marketplace and the Buyer Dashboard.
 * `mode: 'public'` replaces buyer actions with sign-in links.
 */
export function ListingDetailView({ l, meta, mode, crumbs }: { l: ListingDetail; meta: MarketMeta | null; mode: 'buyer' | 'public'; crumbs: Crumb[] }) {
  const images = l.media.filter((x) => x.contentType.startsWith('image/'));
  const videos = l.media.filter((x) => x.contentType.startsWith('video/'));
  const cover = mediaSrc(images[0]?.url);
  const digital = l.kind === 'DIGITAL_PRODUCT';
  const checkoutOpen = !!meta?.terms.checkoutEnabled && !!meta.terms.paymentsConfigured;
  const next = encodeURIComponent(`/buyer/listings/${l.id}`);
  return (
    <>
      <PageHeader
        title={l.title}
        description={l.summary}
        crumbs={crumbs}
        actions={
          <div className={m.actions}>
            <Badge tone="green">{l.category ?? assetLabel(l.assetType)}</Badge>
            <Badge>{kindLabel(l.kind)}</Badge>
            {l.own && l.status && <StatusBadge map={LISTING_STATUS} value={l.status} />}
          </div>
        }
      />
      <div className={m.two}>
        <div className={m.stack}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt={`${l.title} preview`} className={m.hero} />}
          {(images.length > 1 || videos.length > 0) && (
            <Panel title="Media">
              <div className={m.gallery}>
                {images.slice(1).map((x) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={x.id} src={mediaSrc(x.url) ?? ''} alt={x.filename} loading="lazy" />
                ))}
                {videos.map((x) => (
                  <video key={x.id} src={mediaSrc(x.url) ?? ''} controls preload="metadata" aria-label={x.filename} />
                ))}
              </div>
            </Panel>
          )}
          <Panel title="About this asset">
            <p className={m.prose}>{l.description}</p>
            {l.highlights.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>Highlights</h3>
                <ul className={m.list}>
                  {l.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
          {l.aiGenerated && (
            <Notice tone="amber" title="AI-generated content disclosure">
              {l.aiDisclosure ?? 'The seller disclosed that material parts of this asset were created with AI tools.'}
            </Notice>
          )}
          {digital && (
            <Panel title="What you receive" description="Files are delivered as secure, time-limited downloads after payment is confirmed.">
              {l.deliverables.length ? (
                <ul className={m.list}>
                  {l.deliverables.map((f) => (
                    <li key={f.filename}>
                      {f.filename} · {fileSize(f.sizeBytes)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={m.muted}>The seller has not listed any files.</p>
              )}
              <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>Licence</h3>
              <p className={m.prose}>{l.licenseTerms ?? 'No licence terms provided.'}</p>
            </Panel>
          )}
        </div>
        <div className={m.stack}>
          <Panel title={digital ? 'Price' : 'Asking price'}>
            <p className={m.price} style={{ fontSize: 28, margin: '0 0 10px' }}>
              {money(l.askingPriceMinor, l.currency)}
            </p>
            <KeyValue label="Monthly revenue" value={l.monthlyRevenueMinor !== null ? `${money(l.monthlyRevenueMinor, l.currency)} (seller-reported)` : '—'} />
            <KeyValue label="Monthly visitors" value={l.monthlyVisitors !== null ? `${l.monthlyVisitors.toLocaleString('en-US')} (seller-reported)` : '—'} />
            <KeyValue label="Stage" value={l.stage ?? '—'} />
            <KeyValue label="Website" value={l.url ? <a href={l.url} target="_blank" rel="noreferrer nofollow">{l.url.replace(/^https:\/\//, '')}</a> : l.urlHidden ? <span><Lock size={13} aria-hidden /> Shared after {digital ? 'purchase' : 'the seller accepts an introduction'}</span> : '—'} />
            <KeyValue label="Location" value={l.location ?? '—'} />
            <KeyValue label="Language" value={l.language ?? '—'} />
            <KeyValue label="Listed" value={formatDate(l.publishedAt)} />
            <div style={{ marginTop: 14 }}>{mode === 'public' ? <PublicActions digital={digital} next={next} /> : <BuyerActions l={l} digital={digital} checkoutOpen={checkoutOpen} />}</div>
          </Panel>
          {l.seller && (
            <Panel title="Seller">
              <p style={{ margin: '0 0 6px', fontWeight: 700 }}>
                <Link href={`/marketplace/sellers/${l.seller.id}`}>{l.seller.displayName}</Link>
              </p>
              {l.seller.headline && <p className={m.muted} style={{ margin: '0 0 8px' }}>{l.seller.headline}</p>}
              <ul className={m.list} style={{ listStyle: 'none', padding: 0 }}>
                <li>
                  {l.seller.checks.identity ? <BadgeCheck size={14} color="#059669" aria-hidden /> : <ShieldCheck size={14} aria-hidden />} Identity {l.seller.checks.identity ? 'verified' : 'not verified'}
                </li>
                <li>
                  {l.seller.checks.business ? <BadgeCheck size={14} color="#059669" aria-hidden /> : <ShieldCheck size={14} aria-hidden />} Business {l.seller.checks.business ? 'verified' : 'not verified'}
                </li>
                <li>
                  {l.seller.liveListings} live · {l.seller.soldListings} sold · member since {formatDate(l.seller.memberSince)}
                </li>
              </ul>
            </Panel>
          )}
          <Notice tone="neutral" title="Buy safely">
            Keep messages, offers and payments on AmpliVerify. Never share passwords in messages. Verification checks are shown separately; review the evidence yourself before you buy.
          </Notice>
        </div>
      </div>
    </>
  );
}

function PublicActions({ digital, next }: { digital: boolean; next: string }) {
  return (
    <div className={m.stack} style={{ gap: 8 }}>
      <ButtonLink href={`/signup?next=${next}`} block>
        {digital ? 'Create a free account to buy' : 'Create a free account to request an introduction'}
      </ButtonLink>
      <ButtonLink href={`/login?next=${next}`} variant="outline" block>
        Log in
      </ButtonLink>
      <p className={m.muted} style={{ margin: 0 }}>
        Buying on the Marketplace does not need an SEO plan or credits.
      </p>
    </div>
  );
}

function BuyerActions({ l, digital, checkoutOpen }: { l: ListingDetail; digital: boolean; checkoutOpen: boolean }) {
  if (l.own)
    return (
      <ButtonLink href={`/seller/listings/${l.id}`} block>
        Manage this listing
      </ButtonLink>
    );
  const v = l.viewer;
  const rows: ReactNode[] = [];
  if (digital) {
    if (v?.purchasedOrderId)
      rows.push(
        <ButtonLink key="own" href="/buyer/downloads" block>
          You own this · My Downloads
        </ButtonLink>,
      );
    else if (checkoutOpen)
      rows.push(
        <ButtonLink key="buy" href={`/buyer/checkout/${l.id}`} block>
          Buy now
        </ButtonLink>,
      );
    else
      rows.push(
        <Notice key="closed" tone="neutral">
          Checkout opens soon. Save the listing or ask the seller a question meanwhile.
        </Notice>,
      );
  } else if (v?.offer) {
    rows.push(
      <ButtonLink key="offer" href={`/buyer/offers/${v.offer.id}`} block>
        View your offer
      </ButtonLink>,
    );
  }
  if (v?.inquiry && v.inquiry.status !== 'CLOSED')
    rows.push(
      <ButtonLink key="thread" href={`/buyer/inquiries/${v.inquiry.id}`} variant={rows.length ? 'outline' : 'primary'} block>
        {v.inquiry.introStatus === 'PENDING' ? 'Introduction requested · view' : 'Open conversation'}
      </ButtonLink>,
    );
  return (
    <div className={m.stack} style={{ gap: 10 }}>
      {rows}
      {v && <SaveButton listingId={l.id} saved={v.saved} label />}
      {(!v?.inquiry || v.inquiry.status === 'CLOSED') && (
        <details open={!digital}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{digital ? 'Ask the seller a question' : 'Request an introduction'}</summary>
          <div style={{ marginTop: 10 }}>
            <ApiForm path={`/user/marketplace/listings/${l.id}/inquiries`} submitLabel={digital ? 'Send question' : 'Request introduction'} successMessage={digital ? 'Question sent.' : 'Introduction requested. The seller will review it.'} redirectTo="/buyer/inquiries/{id}">
              <Field label="Message to the seller" htmlFor="inq-msg" hint="At least 10 characters. Your email address is not shared.">
                <Textarea id="inq-msg" name="message" required minLength={10} maxLength={4000} rows={4} />
              </Field>
              {!digital && (
                <>
                  <Field label="I am a… (optional)" htmlFor="inq-role">
                    <Input id="inq-role" name="buyerRole" maxLength={80} placeholder="Individual investor, agency, company" />
                  </Field>
                  <Field label="Budget (optional)" htmlFor="inq-budget">
                    <Input id="inq-budget" name="budget" maxLength={80} />
                  </Field>
                </>
              )}
            </ApiForm>
          </div>
        </details>
      )}
    </div>
  );
}
