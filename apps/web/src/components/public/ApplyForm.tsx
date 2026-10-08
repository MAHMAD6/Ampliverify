'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useTransition } from 'react';
import { submitApplication } from '@/lib/public-actions';
import s from './site.module.css';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Job application (public-careers-application/01). Files go to private
 * storage via the API; the success page is shown only for a receipt the
 * API confirms.
 */
export function ApplyForm({ slug, closed, requireResume, requireCoverLetter }: { slug: string; closed: boolean; requireResume: boolean; requireCoverLetter: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    for (const key of ['resume', 'coverLetter']) {
      const f = form.get(key);
      if (f instanceof File && f.size > MAX_BYTES) return setError('Files must be 10 MB or smaller.');
    }
    if (requireCoverLetter) {
      const cover = form.get('coverLetter');
      if (!(cover instanceof File && cover.size > 0) && !String(form.get('message') ?? '').trim()) return setError('Attach a cover letter or write a message.');
    }
    setError(null);
    start(async () => {
      const r = await submitApplication(slug, form);
      if (!r.ok) return setError(r.message);
      if (r.data.receipt) router.push(`/careers/${encodeURIComponent(slug)}/applied?receipt=${encodeURIComponent(r.data.receipt)}`);
      else setError('We could not confirm your application. Please try again.');
    });
  };

  return (
    <form className={`${s.card} ${s.form}`} style={{ padding: 32, position: 'sticky', top: 100 }} onSubmit={submit} aria-busy={pending}>
      <div className={s.full}>
        <h2 className={s.cardTitle} style={{ marginTop: 0 }}>
          Apply for this role
        </h2>
        <p className={s.cardText}>Submit the information required for this opening. Optional fields are marked.</p>
      </div>
      <fieldset disabled={closed || pending} style={{ display: 'contents' }}>
        <label>
          <span>
            First name <span className={s.req}>*</span>
          </span>
          <input className={s.input} name="firstName" required maxLength={100} placeholder="Enter first name" autoComplete="given-name" />
        </label>
        <label>
          <span>
            Last name <span className={s.req}>*</span>
          </span>
          <input className={s.input} name="lastName" required maxLength={100} placeholder="Enter last name" autoComplete="family-name" />
        </label>
        <label className={s.full}>
          <span>
            Email address <span className={s.req}>*</span>
          </span>
          <input className={s.input} name="email" type="email" required maxLength={254} placeholder="Enter your email" autoComplete="email" />
        </label>
        <label className={s.full}>
          Phone number (optional)
          <input className={s.input} name="phone" type="tel" maxLength={40} placeholder="Enter phone number" autoComplete="tel" />
        </label>
        <label className={s.full}>
          <span>
            Résumé / CV {requireResume ? <span className={s.req}>*</span> : '(optional)'}
          </span>
          <input className={s.input} name="resume" type="file" required={requireResume} accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ paddingTop: 13 }} />
          <small style={{ fontWeight: 400, color: 'var(--mute)' }}>PDF or Word document, up to 10 MB.</small>
        </label>
        {requireCoverLetter && (
          <label className={s.full}>
            Cover letter file (or write it below)
            <input className={s.input} name="coverLetter" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ paddingTop: 13 }} />
          </label>
        )}
        <label>
          LinkedIn profile (optional)
          <input className={s.input} name="linkedinUrl" type="url" maxLength={500} placeholder="https://www.linkedin.com/in/…" />
        </label>
        <label>
          Portfolio / website (optional)
          <input className={s.input} name="portfolioUrl" type="url" maxLength={500} placeholder="https://" />
        </label>
        {/* Honeypot: hidden from people, filled by bots. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }} />
        <label className={s.full}>
          <span>
            {requireCoverLetter ? 'Cover letter' : 'Message'} {requireCoverLetter ? '' : '(optional)'}
          </span>
          <textarea className={s.input} name="message" maxLength={5000} placeholder="Add a short note relevant to your application." />
        </label>
        <p className={`${s.full} ${s.cardText}`} style={{ fontSize: 13 }}>
          By submitting this application, you acknowledge that the information you provide will be processed for recruitment purposes in accordance with the AmpliVerify <Link href="/legal#privacy">privacy notice</Link>.
        </p>
        <label className={s.full} style={{ display: 'flex', gap: 10, fontWeight: 400 }}>
          <input type="checkbox" name="consent" required /> I confirm that the information provided is accurate and I agree to the application privacy terms.
        </label>
        <div className={s.full} style={{ display: 'grid', gap: 10 }}>
          <button type="submit" className={s.btn}>
            {pending ? 'Submitting…' : 'Submit Application'}
          </button>
          {closed && <p className={s.notice}>This role is no longer accepting applications.</p>}
          {error && (
            <p className={s.notice} role="alert">
              {error}
            </p>
          )}
        </div>
      </fieldset>
    </form>
  );
}
