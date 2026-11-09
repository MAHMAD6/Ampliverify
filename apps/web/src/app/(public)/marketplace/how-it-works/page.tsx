import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckList, CtaBand, PageHero } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = {
  title: 'How the Marketplace Works',
  description: 'How buying and selling works on the AmpliVerify Marketplace: seller verification, listing review, introductions, offers, secure checkout and transfer.',
  alternates: { canonical: '/marketplace/how-it-works' },
};

const BUY_PRODUCT = ['Review the product, its licence and the refund policy', 'Give the required consent and pay through our secure checkout', 'Your purchase is confirmed when the payment provider confirms payment', 'Download from My Downloads with short-lived secure links', 'Report a problem from your purchase page if something is wrong'];
const BUY_BUSINESS = ['Request an introduction with a short message', 'The seller approves the introduction, then you can message', 'Make an offer; each counter-offer is a new version', 'Agree terms, complete due diligence and transfer', 'Confirm receipt to complete the transaction'];
const SELL = ['Create a free account and a seller profile', 'Complete identity verification (business verification if you sell as a company)', 'Create a listing with accurate details, media and licence terms', 'Submit it for review; our team approves, requests changes or rejects', 'Answer inquiries, negotiate and deliver; request payouts from US $50'];

export default function MarketplaceHowItWorks() {
  return (
    <>
      <PageHero eyebrow="Marketplace" title="How the Marketplace works" lead="Two kinds of listings, one clear process: downloadable digital products are bought through secure checkout; websites and online businesses are sold through introductions, offers and a guided transfer." center />
      <section className={s.section}>
        <div className={s.container} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28 }}>
          <div className={s.card}>
            <div className={s.eyebrow}>Buyers</div>
            <h2 className={s.cardTitle}>Buying a digital product</h2>
            <CheckList items={BUY_PRODUCT} />
          </div>
          <div className={s.card}>
            <div className={s.eyebrow}>Buyers</div>
            <h2 className={s.cardTitle}>Acquiring a website or business</h2>
            <CheckList items={BUY_BUSINESS} />
          </div>
          <div className={s.card}>
            <div className={s.eyebrow}>Sellers</div>
            <h2 className={s.cardTitle}>Selling on AmpliVerify</h2>
            <CheckList items={SELL} />
          </div>
        </div>
      </section>
      <section className={s.sectionAlt}>
        <div className={s.container}>
          <h2 className={s.h2}>What our checks mean</h2>
          <p className={s.lead}>Each badge stands for one specific check. Passing one check does not imply another.</p>
          <ul className={s.list} style={{ marginTop: 16 }}>
            <li><b>Identity verified</b>: we reviewed the seller’s identity documents.</li>
            <li><b>Business verified</b>: we reviewed the seller’s business registration.</li>
            <li><b>Ownership</b>: the seller proved control of the website or asset.</li>
            <li><b>Traffic / financials</b>: figures were checked against connected data or documents. Otherwise they are labelled seller-reported.</li>
            <li><b>AI screening</b>: content was screened for AI generation; results can flag content for review but do not prove authorship.</li>
          </ul>
          <p className={s.cardText} style={{ marginTop: 16 }}>
            See the <Link href="/seller-guidelines">Seller Guidelines</Link> and the <Link href="/digital-product-refund-policy">Digital Product Refund Policy</Link>.
          </p>
        </div>
      </section>
      <CtaBand title="Find your next digital asset" text="Browse listings reviewed by our team, or list your own." primary={{ label: 'Browse listings', href: '/marketplace/listings' }} secondary={{ label: 'Sell a digital asset', href: '/sell' }} />
    </>
  );
}
