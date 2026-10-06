import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/public/AuthCard';
import { LoginForm } from '@/components/public/auth/AuthForms';
import { enabledSocialProviders } from '@/lib/auth';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Log In' };

/** Log In (public-auth/01). Better Auth email/password; Google and Microsoft are enabled only when configured. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const { next, error, reset } = await searchParams;
  return (
    <AuthCard eyebrow="Welcome Back" title="Sign in to AmpliVerify" lead="Access your projects, audits, optimization workflows, reports, and account settings." cardTitle="Sign In" cardText="Use your AmpliVerify account credentials to continue.">
      {reset && (
        <p role="status" className={s.pending} style={{ marginBottom: 14 }}>
          Your password has been updated. Sign in with your new password.
        </p>
      )}
      <LoginForm next={next} error={error} providers={enabledSocialProviders} />
      <p className={s.cardText} style={{ textAlign: 'center', marginTop: 16 }}>
        New to AmpliVerify?{' '}
        <Link href="/signup" style={{ fontWeight: 700 }}>
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
