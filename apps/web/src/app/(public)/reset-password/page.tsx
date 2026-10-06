import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard, AuthPending } from '@/components/public/AuthCard';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Reset Password' };

/** Reset Password (public-auth/03). The token comes from the emailed link and is validated by the auth service. */
export default function ResetPasswordPage() {
  return (
    <AuthCard eyebrow="Account Recovery" title="Choose a new password" lead="Set a new password for your AmpliVerify account." cardTitle="Reset Password" cardText="Use at least 8 characters. Avoid passwords you use elsewhere.">
      <form className={s.form} style={{ gridTemplateColumns: '1fr' }}>
        <label>
          New password
          <input className={s.input} type="password" name="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required />
        </label>
        <label>
          Confirm new password
          <input className={s.input} type="password" name="confirm" autoComplete="new-password" minLength={8} placeholder="Re-enter your new password" required />
        </label>
        <button type="submit" className={s.btn} disabled>
          Update Password
        </button>
      </form>
      <AuthPending />
      <p className={s.cardText} style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/login" style={{ fontWeight: 700 }}>
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
