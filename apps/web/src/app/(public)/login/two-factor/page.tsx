import type { Metadata } from 'next';
import { AuthCard } from '@/components/public/AuthCard';
import { TwoFactorForm } from '@/components/public/auth/AuthForms';

export const metadata: Metadata = { title: 'Two-step verification' };

/** Second sign-in step for accounts with multi-factor authentication. */
export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard eyebrow="Two-step verification" title="Confirm it’s you" lead="Your account is protected with multi-factor authentication." cardTitle="Enter your code" cardText="Open your authenticator app and enter the 6-digit code.">
      <TwoFactorForm next={next} />
    </AuthCard>
  );
}
