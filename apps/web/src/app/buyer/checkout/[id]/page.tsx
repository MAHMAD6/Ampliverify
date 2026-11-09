import { notFound } from 'next/navigation';
import { ButtonLink, KeyValue, Notice, PageHeader, Panel } from '@/components/ui';
import { CheckoutForm } from '@/components/market/forms';
import { LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { fileSize, type ListingDetail, type MarketMeta, money } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Checkout · Marketplace' };

/** Digital products only: licence, refund policy and AI disclosures shown and accepted before payment (V2 guide §3.3). */
export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [res, meta] = await Promise.all([apiGet<ListingDetail>(`/user/marketplace/listings/${id}`, { auth: true }), apiGet<MarketMeta>('/public/marketplace/meta', { revalidate: 60 })]);
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="Checkout" />;
  const l = res.data;
  const crumbs = [{ label: 'Browse', href: '/buyer/browse' }, { label: l.title, href: `/buyer/listings/${l.id}` }, { label: 'Checkout' }];
  if (l.kind !== 'DIGITAL_PRODUCT' || l.own)
    return (
      <>
        <PageHeader title="Checkout" crumbs={crumbs} />
        <Notice tone="neutral" title={l.own ? 'This is your listing.' : 'Business acquisitions are not bought at checkout.'}>
          {l.own ? 'You cannot buy your own listing.' : 'Request an introduction, then make an offer. The transfer is tracked step by step.'}
        </Notice>
      </>
    );
  if (l.viewer?.purchasedOrderId)
    return (
      <>
        <PageHeader title="Checkout" crumbs={crumbs} />
        <Notice tone="green" title="You already own this item.">
          <ButtonLink href="/buyer/downloads" size="sm">
            Go to My Downloads
          </ButtonLink>
        </Notice>
      </>
    );
  const terms = meta.ok ? meta.data.terms : null;
  const open = !!terms?.checkoutEnabled && !!terms.paymentsConfigured;
  const price = money(l.askingPriceMinor, l.currency);
  return (
    <>
      <PageHeader title="Review and pay" description="Payment is processed securely by Stripe. Files unlock only after the payment is confirmed." crumbs={crumbs} />
      <div className={m.two}>
        <div className={m.stack}>
          <Panel title="Licence terms">
            <p className={m.prose}>{l.licenseTerms ?? 'No licence terms provided.'}</p>
          </Panel>
          {l.aiGenerated && (
            <Notice tone="amber" title="AI-generated content disclosure">
              {l.aiDisclosure ?? 'Material parts of this product were created with AI tools.'}
            </Notice>
          )}
          <Panel title="Refunds">
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              If a file is faulty, missing or not as described, report it from your purchase within {terms?.reportingWindowDays ?? 7} days so we can help quickly. This is a reporting guideline, not a cut-off: your statutory consumer rights are not
              limited by it. Read the full <a href="/digital-product-refund-policy">Digital Product Refund Policy</a>.
            </p>
          </Panel>
          <Panel title="Confirm">
            {open ? (
              <CheckoutForm listingId={l.id} price={price} withdrawal />
            ) : (
              <Notice tone="neutral" title="Checkout is not open yet.">
                Digital-product payments are being prepared. Save the listing and check back soon.
              </Notice>
            )}
          </Panel>
        </div>
        <Panel title="Order summary">
          <KeyValue label="Item" value={l.title} />
          <KeyValue label="Seller" value={l.seller?.displayName ?? '—'} />
          <KeyValue label="Files" value={l.deliverables.length ? l.deliverables.map((f) => `${f.filename} (${fileSize(f.sizeBytes)})`).join(', ') : '—'} />
          <KeyValue label="Total" value={<b>{price}</b>} />
          <p className={m.muted} style={{ marginTop: 8 }}>
            Marketplace purchases do not use SEO credits or require a plan.
          </p>
        </Panel>
      </div>
    </>
  );
}
