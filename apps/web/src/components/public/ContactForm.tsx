'use client';

import Link from 'next/link';
import { type FormEvent, useState, useTransition } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { submitContact } from '@/lib/public-actions';
import { CONTACT_TOPICS } from './contact-topics';
import site from './site.module.css';
import s from './pages.module.css';

const MAX = 1000;

/** Contact form (Public_Frontend "Contact Page"). Success is shown only after the API stores the message. */
export function ContactForm({ topic }: { topic: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [len, setLen] = useState(0);
  const [sent, setSent] = useState<{ reference?: string } | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? '').trim();
    if (!get('topic')) return setError('Please select a topic.');
    const url = get('site');
    setError(null);
    start(async () => {
      const r = await submitContact({
        name: get('name'),
        email: get('email'),
        ...(get('company') ? { company: get('company') } : {}),
        topic: get('topic'),
        message: url ? `${get('message')}\n\nWebsite: ${url}` : get('message'),
        ...(get('website') ? { website: get('website') } : {}),
      });
      if (!r.ok) return setError(r.message);
      setSent({ reference: r.data.reference });
    });
  };

  if (sent)
    return (
      <div className={`${s.card} ${s.sent}`} role="status">
        <CheckCircle2 size={48} color="#0e5e2b" style={{ margin: '0 auto' }} />
        <h2 className={s.h2} style={{ fontSize: 26 }}>
          Message sent
        </h2>
        <p className={s.muted}>Thanks for getting in touch. The right person on our team will reply to the email address you gave us.</p>
        {sent.reference && <p className={s.muted}>Reference: {sent.reference}</p>}
      </div>
    );

  return (
    <form className={`${s.card} ${s.form}`} onSubmit={submit} aria-busy={pending}>
      <label>
        <span>
          Full name <span className={s.req}>*</span>
        </span>
        <input className={s.input} name="name" required minLength={2} maxLength={120} placeholder="Jane Smith" autoComplete="name" />
      </label>
      <label>
        <span>
          Email <span className={s.req}>*</span>
        </span>
        <input className={s.input} name="email" type="email" required maxLength={254} placeholder="you@example.com" autoComplete="email" />
      </label>
      <label>
        Company (optional)
        <input className={s.input} name="company" maxLength={160} placeholder="Company name" autoComplete="organization" />
      </label>
      <label>
        Website (optional)
        <input className={s.input} name="site" type="url" maxLength={200} placeholder="https://yourwebsite.com" />
      </label>
      {/* Honeypot: hidden from people, filled by bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }} />
      <label className={s.full}>
        <span>
          How can we help? <span className={s.req}>*</span>
        </span>
        <select className={s.input} name="topic" defaultValue={topic} required>
          <option value="">Select a topic</option>
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
        <textarea className={s.input} name="message" required minLength={10} maxLength={MAX} placeholder="Tell us how we can help." onChange={(e) => setLen(e.target.value.length)} />
        <span className={s.count} aria-live="polite">
          {len.toLocaleString('en-US')} / {MAX.toLocaleString('en-US')}
        </span>
      </label>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.formFoot}>
        <small>
          Fields marked <span className={s.req}>*</span> are required. By sending this form you agree to our <Link href="/legal">Privacy Policy</Link>.
        </small>
        <button type="submit" className={site.btn} disabled={pending}>
          {pending ? 'Sending…' : 'Send Message'} <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
}
