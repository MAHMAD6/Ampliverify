import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, HelpCircle } from 'lucide-react';
import { CONTACT_TOPICS, ContactForm } from '@/components/public/ContactForm';
import { PageHero } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Contact' };

/**
 * Contact (public-website-v2/09). Messages are stored (contact_submissions)
 * and routed to the admin inbox. The design's sales email and office address
 * are placeholders and are omitted.
 */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const requested = (await searchParams).topic;
  const topic = CONTACT_TOPICS.find(([k]) => k === requested?.toUpperCase() || (requested === 'partnerships' && k === 'PARTNERSHIP'))?.[0] ?? 'SALES';
  return (
    <>
      <PageHero eyebrow="Contact" title="Get in Touch" lead="Questions about AmpliVerify, pricing or partnerships? Send us a message and the right person will get back to you." />
      <section className={s.section}>
        <div className={s.container} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(280px, 1fr)', gap: 40, alignItems: 'start' }}>
          <ContactForm topic={topic} />
          <div style={{ display: 'grid', gap: 16 }}>
            <div className={s.card} style={{ display: 'flex', gap: 16 }}>
              <span className={s.icon}>
                <BarChart3 size={22} />
              </span>
              <div>
                <h3 className={s.cardTitle} style={{ marginTop: 0 }}>
                  Sales
                </h3>
                <p className={s.cardText}>Talk to us about plans for teams and agencies.</p>
                <Link href="/pricing" className={s.learn}>
                  See pricing <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className={s.card} style={{ display: 'flex', gap: 16 }}>
              <span className={s.icon}>
                <HelpCircle size={22} />
              </span>
              <div>
                <h3 className={s.cardTitle} style={{ marginTop: 0 }}>
                  Support
                </h3>
                <p className={s.cardText}>Most answers are in our Help Center.</p>
                <Link href="/help" className={s.learn}>
                  Visit Help Center <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
