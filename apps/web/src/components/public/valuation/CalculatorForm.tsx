'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Globe, Link2 } from 'lucide-react';
import { startValuation } from '@/lib/public-actions';
import site from '../site.module.css';
import s from './valuation.module.css';

/** Domain input that starts a valuation and opens its report. */
export function CalculatorForm({ disabled, disabledReason, icon = 'globe', notes = ['No signup required', 'Free to use', 'Instant results'] }: { disabled?: boolean; disabledReason?: string; icon?: 'globe' | 'link'; notes?: string[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className={s.wrap}>
      <form
        className={s.calc}
        onSubmit={(e) => {
          e.preventDefault();
          const domain = String(new FormData(e.currentTarget).get('domain') ?? '').trim();
          if (!domain) return setError('Enter your website domain.');
          setError(null);
          start(async () => {
            const r = await startValuation(domain);
            if (!r.ok) return setError(r.message);
            router.push(`/website-value/report/${r.data.id}`);
          });
        }}
      >
        <label>
          {icon === 'globe' ? <Globe size={20} aria-hidden /> : <Link2 size={20} aria-hidden />}
          <input name="domain" placeholder="Enter your website domain (e.g. example.com)" aria-label="Website domain" autoComplete="url" maxLength={2048} disabled={disabled || pending} />
        </label>
        <button type="submit" className={site.btn} disabled={disabled || pending}>
          {pending ? 'Calculating…' : 'Calculate Value'} <ArrowRight size={18} />
        </button>
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
