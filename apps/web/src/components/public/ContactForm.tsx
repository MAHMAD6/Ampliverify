'use client';

import Link from 'next/link';
import { type FormEvent, useState, useTransition } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { submitContact } from '@/lib/public-actions';
import s from './site.module.css';

export const CONTACT_TOPICS = [
  ['SALES', 'Sales and pricing'],
  ['SUPPORT', 'Product support'],
  ['BILLING', 'Billing'],
  ['PARTNERSHIP', 'Partnerships'],
  ['PRESS', 'Press'],
  ['OTHER', 'Something else'],
] as const;

/** Contact form (public-website-v2/09). Success is shown only after the API stores the message. */
export function ContactForm({ topic }: { topic: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ reference?: string } | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? '').trim();
    const site = get('site');
    setError(null);
    start(async () => {
      const r = await submitContact({
        name: get('name'),
        email: get('email'),
        ...(get('company') ? { company: get('company') } : {}),
        topic: get('topic'),
        message: site ? `${get('message')}\n\nWebsite: ${site}` : get('message'),
        ...(get('website') ? { website: get('website') } : {}),
      });
      if (!r.ok) return setError(r.message);
      setSent({ reference: r.data.reference });
    });
  };

  if (sent)
    return (
      <div className={s.card} style={{ padding: 36, textAlign: 'center' }} role="status">
        <CheckCircle2 size={48} color="var(--g900)" style={{ margin: '0 auto' }} />
        <h2 className={s.cardTitle}>Message sent</h2>
        <p className={s.cardText}>Thanks for getting in touch. The right person on our team will reply to the email address you gave us.</p>
        {sent.reference && <p className={s.cardText}>Reference: {sent.reference}</p>}
      </div>
    );

  return (
    <form className={`${s.card} ${s.form}`} style={{ padding: 36 }} onSubmit={submit} aria-busy={pending}>
      <label>
        <span>
          Full name <span className={s.req}>*</span>
        </span>
        <input className={s.input} name="name" required minLength={2} maxLength={120} placeholder="Jane Smith" autoComplete="name" />
      </label>
      <label>
        <span>
          Work email <span className={s.req}>*</span>
        </span>
        <input className={s.input} name="email" type="email" required maxLength={254} placeholder="you@company.com" autoComplete="email" />
      </label>
      <label>
        Company
        <input className={s.input} name="company" maxLength={160} placeholder="Company name" autoComplete="organization" />
      </label>
      <label>
        Website
        <input className={s.input} name="site" maxLength={200} placeholder="yourwebsite.com" />
      </label>
      {/* Honeypot: hidden from people, filled by bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }} />
      <label className={s.full}>
        How can we help?
        <select className={s.input} name="topic" defaultValue={topic}>
          {CONTACT_TOPICS.map(([k, l]) => (
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
        <textarea className={s.input} name="message" required minLength={10} maxLength={4800} placeholder="Tell us a little about your website and goals" />
      </label>
      <div className={s.full} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <small style={{ color: 'var(--mute)', maxWidth: 420 }}>
          Fields marked * are required. By sending this form you agree to our <Link href="/legal#privacy">Privacy Policy</Link>.
        </small>
        <button type="submit" className={s.btn} disabled={pending}>
          {pending ? 'Sending…' : 'Send Message'} <Send size={16} />
        </button>
      </div>
      {error && (
        <p className={`${s.full} ${s.notice}`} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
