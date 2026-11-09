import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Banknote, FileCheck2, PackagePlus, UserRound } from 'lucide-react';
import { CheckList, CtaBand, PageHero } from '@/components/public/Blocks';
import { apiGet } from '@/lib/api';
import type { MarketMeta } from '@/lib/marketplace';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = {
  title: 'Sell a Digital Asset',
  description: 'List your website, online business or downloadable digital product on the AmpliVerify Marketplace. Verified sellers, reviewed listings, payouts from US $50.',
  alternates: { canonical: '/sell' },
};

export default async function SellPage() {
  const meta = await apiGet<MarketMeta>('/public/marketplace/meta', { revalidate: 300 });
  const t = meta.ok ? meta.data.terms : null;
  const commission = t ? `${(t.commissionBps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%` : null;
  const threshold = t ? t.payoutThresholdMinor / 100 : 50;
  return (
    <>
      <PageHero eyebrow="Sell on AmpliVerify" title="Sell your website or digital product" lead="Reach buyers looking for reviewed, verified digital assets. List websites and online businesses for acquisition, or sell downloadable products through secure checkout." center>
        <div className={s.heroActions}>
          <Link href="/signup?next=%2Fseller" className={s.btn}>
            Start selling <ArrowRight size={18} />
          </Link>
          <Link href="/login?next=%2Fseller" className={s.btnOutline}>
            I already have an account
          </Link>
        </div>
      </PageHero>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.grid4}>
            {[
              [<UserRound key="i" size={24} />, '1. Seller profile', 'Tell buyers who you are and what you sell.'],
              [<BadgeCheck key="i" size={24} />, '2. Verification', 'Complete identity verification; add business verification if you sell as a company.'],
              [<PackagePlus key="i" size={24} />, '3. Create a listing', 'Describe the asset accurately, add media and licence terms, then submit for review.'],
              [<Banknote key="i" size={24} />, '4. Get paid', `Connect a payout account and request payouts once eligible earnings reach US $${threshold}.`],
            ].map(([icon, title, text]) => (
              <div key={String(title)} className={s.card}>
                <span className={s.icon} aria-hidden>
                  {icon}
                </span>
                <h2 className={s.cardTitle}>{title}</h2>
                <p className={s.cardText}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className={s.sectionAlt}>
        <div className={s.container} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
          <div>
            <h2 className={s.h2}>Fees and payouts</h2>
            <CheckList
              items={[
                'No listing fee',
                commission ? `${commission} commission on digital product sales` : 'Commission on digital product sales, shown before you list',
                `Payouts from US $${threshold} in eligible earnings`,
                t ? `Earnings become available ${t.holdDays} day${t.holdDays === 1 ? '' : 's'} after a sale` : 'Earnings become available after a short hold',
              ]}
            />
          </div>
          <div>
            <h2 className={s.h2}>Listing standards</h2>
            <CheckList items={['Accurate, truthful descriptions; no invented traffic, revenue or reviews', 'Clear licence terms for every digital product', 'Disclosure of material AI-generated content', 'Rights to sell or transfer everything you list']} />
            <p className={s.cardText}>
              <FileCheck2 size={16} aria-hidden /> Read the <Link href="/seller-guidelines">Seller Guidelines</Link> before you list.
            </p>
          </div>
        </div>
      </section>
      <CtaBand title="List your first asset" text="Create a free account and set up your seller profile in a few minutes." primary={{ label: 'Start selling', href: '/signup?next=%2Fseller' }} secondary={{ label: 'How the Marketplace works', href: '/marketplace/how-it-works' }} />
    </>
  );
}
