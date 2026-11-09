import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { CtaBand, PageHero } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Marketplace FAQ', description: 'Answers to common questions about buying and selling on the AmpliVerify Marketplace.', alternates: { canonical: '/marketplace/faq' } };

const FAQ: [string, string][] = [
  [
    "Do I need an SEO plan or credits to buy?",
    "No. Buying on the Marketplace is separate from SEO plans and credits. A free account is enough."
  ],
  [
    "How are listings reviewed?",
    "Every listing is reviewed by a member of our team before it is published. We may approve it, ask the seller for changes or reject it."
  ],
  [
    "What does \"Identity verified\" mean?",
    "We reviewed the seller’s identity documents. It does not verify a listing’s traffic, revenue or ownership; those are separate checks and are labelled separately."
  ],
  [
    "How do I buy a digital product?",
    "Open the product, review the licence and refund policy, give the required consent and pay through secure checkout. Downloads unlock once the payment provider confirms payment."
  ],
  [
    "How do I buy a website or online business?",
    "Request an introduction. When the seller approves it you can message, make offers, agree terms, complete due diligence and transfer the asset."
  ],
  [
    "Can I get a refund?",
    "Refunds for digital products are considered under the Digital Product Refund Policy. Please report problems within seven days; this guideline does not limit your statutory rights."
  ],
  [
    "How do sellers get paid?",
    "Sellers connect a payout account and can request a payout once eligible earnings reach US $50. Earnings may be held for a short period to cover refunds."
  ],
  [
    "What fees do sellers pay?",
    "A commission on digital product sales, shown in your seller dashboard before you list. There is no listing fee."
  ],
  [
    "Can I sell AI-generated content?",
    "Yes, if you disclose material AI generation or assistance and have the rights to sell it. See the Seller Guidelines."
  ]
];

export default function MarketplaceFaq() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return (
    <>
      <PageHero eyebrow="Marketplace" title="Marketplace FAQ" lead="Answers for buyers and sellers." center />
      <section className={s.section}>
        <div className={s.container}>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
          <div className={s.faq}>
            <div>
              <h2 className={s.h2}>Questions?</h2>
              <p className={s.cardText}>
                Still need help? <Link href="/contact">Contact our team</Link> or visit the <Link href="/help">Help Center</Link>.
              </p>
            </div>
            <div>
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q} <ChevronDown size={18} aria-hidden />
                  </summary>
                  <p className={s.cardText}>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
      <CtaBand title="Ready to get started?" text="Browse reviewed listings or list your own digital asset." primary={{ label: 'Browse listings', href: '/marketplace/listings' }} secondary={{ label: 'Sell a digital asset', href: '/sell' }} />
    </>
  );
}
