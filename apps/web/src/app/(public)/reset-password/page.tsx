import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/public/AuthCard';
import { ResetPasswordForm } from '@/components/public/auth/AuthForms';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Reset Password' };

/** Reset Password (public-auth/03). The token comes from the emailed link and is validated by the auth service. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <AuthCard eyebrow="Account Recovery" title="Choose a new password" lead="Set a new password for your AmpliVerify account." cardTitle="Reset Password" cardText="Use at least 8 characters. Avoid passwords you use elsewhere.">
      <ResetPasswordForm token={token} error={error} />
      <p className={s.cardText} style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/login" style={{ fontWeight: 700 }}>
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
