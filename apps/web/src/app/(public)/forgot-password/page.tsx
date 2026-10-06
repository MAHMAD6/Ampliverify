import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/public/AuthCard';
import { ForgotPasswordForm } from '@/components/public/auth/AuthForms';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Forgot Password' };

/** Forgot Password (public-auth/02). The response never reveals whether an email has an account. */
export default function ForgotPasswordPage() {
  return (
    <AuthCard eyebrow="Account Recovery" title="Reset your password" lead="Enter the email address for your account and we'll send reset instructions if it matches an account." cardTitle="Forgot Password" cardText="We never confirm whether an email address is registered.">
      <ForgotPasswordForm />
      <p className={s.cardText} style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/login" style={{ fontWeight: 700 }}>
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
