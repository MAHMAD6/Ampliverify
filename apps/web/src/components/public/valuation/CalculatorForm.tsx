'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Globe, Link2 } from 'lucide-react';
import { startValuation } from '@/lib/public-actions';
import { reportHref } from '@/lib/valuation';
import site from '../site.module.css';
import s from './valuation.module.css';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);

/** Domain input that starts a valuation (with consent and an idempotency key) and opens its report. */
export function CalculatorForm({
  disabled,
  disabledReason,
  consentVersion,
  icon = 'globe',
  notes = ['No signup required', 'Free to use', 'Quality score in minutes'],
}: {
  disabled?: boolean;
  disabledReason?: string;
  consentVersion?: string;
  icon?: 'globe' | 'link';
  notes?: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // One key per submitted domain, so a double-click or retry never starts a second job.
  const key = useRef<{ domain: string; key: string } | null>(null);
  return (
    <div className={s.wrap}>
      <form
        className={s.calc}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const domain = String(f.get('domain') ?? '').trim();
          if (!domain) return setError('Enter your website domain.');
          if (!f.get('consent')) return setError('Please confirm you agree to the data-collection terms.');
          if (!consentVersion) return setError('The calculator is temporarily unavailable.');
          if (key.current?.domain !== domain) key.current = { domain, key: newKey() };
          setError(null);
          start(async () => {
            const r = await startValuation(domain, consentVersion, key.current!.key);
            if (!r.ok) return setError(r.message);
            router.push(reportHref(r.data.id, r.data.shareToken));
          });
        }}
      >
        <label>
          {icon === 'globe' ? <Globe size={20} aria-hidden /> : <Link2 size={20} aria-hidden />}
          <input name="domain" placeholder="Enter your website domain (e.g. example.com)" aria-label="Website domain" autoComplete="url" maxLength={2048} disabled={disabled || pending} />
        </label>
        <button type="submit" className={site.btn} disabled={disabled || pending}>
          {pending ? 'Starting…' : 'Calculate Value'} <ArrowRight size={18} />
        </button>
        <label className={s.consent}>
          <input type="checkbox" name="consent" value="1" disabled={disabled || pending} required />
          <span>
            I confirm I’m allowed to analyze this site and agree to the collection of its public data (PageSpeed, domain records, search data) under the <Link href="/legal#privacy">Privacy Policy</Link>.
          </span>
        </label>
      </form>
      {(error || (disabled && disabledReason)) && (
        <p className={s.calcErr} role="alert">
          {error ?? disabledReason}
        </p>
      )}
      <div className={s.calcNote}>
        {notes.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}
