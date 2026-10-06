import type { Metadata } from 'next';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { AuthCard, AuthPending } from '@/components/public/AuthCard';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Verify Your Email' };

/** Email Verification (public-auth/04). The verification result comes from the auth service when the emailed link is opened. */
export default function VerifyEmailPage() {
  return (
    <AuthCard eyebrow="Verify Email" title="Check your inbox" lead="We sent a verification link to the email address you signed up with." cardTitle="Email Verification" cardText="Open the link in the email to verify your address. It may take a minute to arrive.">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
        <span className={s.icon} style={{ width: 72, height: 72 }}>
          <MailCheck size={30} />
        </span>
        <button type="button" className={s.btnOutline} disabled>
          Resend Verification Email
        </button>
      </div>
      <AuthPending />
      <p className={s.cardText} style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/login" style={{ fontWeight: 700 }}>
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
