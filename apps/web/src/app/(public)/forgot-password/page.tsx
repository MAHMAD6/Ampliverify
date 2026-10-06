import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard, AuthPending } from '@/components/public/AuthCard';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Forgot Password' };

/** Forgot Password (public-auth/02). The response never reveals whether an email has an account. */
export default function ForgotPasswordPage() {
  return (
    <AuthCard eyebrow="Account Recovery" title="Reset your password" lead="Enter the email address for your account and we'll send reset instructions if it matches an account." cardTitle="Forgot Password" cardText="We never confirm whether an email address is registered.">
      <form className={s.form} style={{ gridTemplateColumns: '1fr' }}>
        <label>
          Email address
          <input className={s.input} type="email" name="email" autoComplete="email" placeholder="Enter your email" required />
        </label>
        <button type="submit" className={s.btn} disabled>
          Send Reset Link
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
