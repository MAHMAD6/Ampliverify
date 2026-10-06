import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, HelpCircle, Send } from 'lucide-react';
import { PageHero } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Contact' };

const TOPICS = [
  ['sales', 'Sales and pricing'],
  ['support', 'Product support'],
  ['partnerships', 'Partnerships'],
  ['press', 'Press'],
  ['careers', 'Careers'],
  ['other', 'Something else'],
] as const;

/**
 * Contact (public-website-v2/09). There is no contact-message storage in the
 * schema yet, so Send Message is disabled rather than pretending to deliver.
 * The design's sales email and office address are placeholders and are omitted.
 */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const requested = (await searchParams).topic;
  const topic = TOPICS.find(([k]) => k === requested)?.[0] ?? 'sales';
  return (
    <>
      <PageHero eyebrow="Contact" title="Get in Touch" lead="Questions about AmpliVerify, pricing or partnerships? Send us a message and the right person will get back to you." />
      <section className={s.section}>
        <div className={s.container} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(280px, 1fr)', gap: 40, alignItems: 'start' }}>
          <form className={`${s.card} ${s.form}`} style={{ padding: 36 }}>
            <label>
              <span>
                Full name <span className={s.req}>*</span>
              </span>
              <input className={s.input} name="name" required placeholder="Jane Smith" autoComplete="name" />
            </label>
            <label>
              <span>
                Work email <span className={s.req}>*</span>
              </span>
              <input className={s.input} name="email" type="email" required placeholder="you@company.com" autoComplete="email" />
            </label>
            <label>
              Company
              <input className={s.input} name="company" placeholder="Company name" autoComplete="organization" />
            </label>
            <label>
              Website
              <input className={s.input} name="website" placeholder="yourwebsite.com" />
            </label>
            <label className={s.full}>
              How can we help?
              <select className={s.input} name="topic" defaultValue={topic}>
                {TOPICS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.full}>
              <span>
                Message <span className={s.req}>*</span>
              </span>
              <textarea className={s.input} name="message" required placeholder="Tell us a little about your website and goals" />
            </label>
            <div className={s.full} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <small style={{ color: 'var(--mute)', maxWidth: 420 }}>
                Fields marked * are required. By sending this form you agree to our <Link href="/legal#privacy">Privacy Policy</Link>. The contact form opens soon.
              </small>
              <button type="submit" className={s.btn} disabled>
                Send Message <Send size={16} />
              </button>
            </div>
          </form>
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
