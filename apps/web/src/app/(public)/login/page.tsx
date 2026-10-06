import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard, AuthPending } from '@/components/public/AuthCard';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Log In' };

/** Log In (public-auth/01). Better Auth handles credentials; MFA/passkeys render only when enabled for the account. */
export default function LoginPage() {
  return (
    <AuthCard eyebrow="Welcome Back" title="Sign in to AmpliVerify" lead="Access your projects, audits, optimization workflows, reports, and account settings." cardTitle="Sign In" cardText="Use your AmpliVerify account credentials to continue.">
      <form className={s.form} style={{ gridTemplateColumns: '1fr' }}>
        <label>
          Email address
          <input className={s.input} type="email" name="email" autoComplete="email" placeholder="Enter your email" required />
        </label>
        <label>
          Password
          <input className={s.input} type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required />
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <label style={{ display: 'flex', gap: 8, fontWeight: 400, alignItems: 'center' }}>
            <input type="checkbox" name="remember" /> Keep me signed in
          </label>
          <Link href="/forgot-password" style={{ fontWeight: 700 }}>
            Forgot password?
          </Link>
        </div>
        <button type="submit" className={s.btn} disabled>
          Sign In
        </button>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--mute)' }}>OR</div>
        <button type="button" className={s.btnOutline} disabled>
          Continue with Google
        </button>
        <button type="button" className={s.btnOutline} disabled>
          Continue with Microsoft
        </button>
      </form>
      <AuthPending />
      <p className={s.cardText} style={{ textAlign: 'center', marginTop: 16 }}>
        New to AmpliVerify?{' '}
        <Link href="/signup" style={{ fontWeight: 700 }}>
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
