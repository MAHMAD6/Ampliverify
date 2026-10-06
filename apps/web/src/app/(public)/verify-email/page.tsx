import type { Metadata } from 'next';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { AuthCard } from '@/components/public/AuthCard';
import { ResendVerification } from '@/components/public/auth/AuthForms';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Verify Your Email' };

/** Email Verification (public-auth/04). The verification result comes from the auth service when the emailed link is opened. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthCard eyebrow="Verify Email" title="Check your inbox" lead={email ? `We sent a verification link to ${email}.` : 'We sent a verification link to the email address you signed up with.'} cardTitle="Email Verification" cardText="Open the link in the email to verify your address. It may take a minute to arrive.">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
        <span className={s.icon} style={{ width: 72, height: 72 }}>
          <MailCheck size={30} />
        </span>
        <ResendVerification email={email} />
      </div>
      <p className={s.cardText} style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/login" style={{ fontWeight: 700 }}>
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
