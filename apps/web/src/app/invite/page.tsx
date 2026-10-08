import Link from 'next/link';
import { AuthCard } from '@/components/public/AuthCard';
import { ActionButton } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { getSession } from '@/lib/session';
import { humanize } from '@/lib/format';

export const metadata = { title: 'Workspace invitation', robots: { index: false, follow: false } };

type Preview = { workspaceName: string; roleKey: string; invitedBy: string; emailHint: string; expiresAt: string };

/** Accept a workspace invitation (sign in or sign up first with the invited email). */
export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const preview = token ? await apiGet<Preview>(`/public/invitations/${encodeURIComponent(token)}`, { revalidate: 0 }) : null;
  const session = await getSession();
  const here = `/invite?token=${encodeURIComponent(token ?? '')}`;
  if (!preview?.ok) {
    return (
      <AuthCard eyebrow="Invitation" title="This invitation is not valid" lead="It may have expired, been revoked or already been used." cardTitle="Need a new invitation?" cardText="Ask a workspace owner to invite you again.">
        <Link href="/app/dashboard">Go to AmpliVerify →</Link>
      </AuthCard>
    );
  }
  const p = preview.data;
  return (
    <AuthCard eyebrow="Invitation" title={`Join ${p.workspaceName}`} lead={`${p.invitedBy} invited ${p.emailHint} to join as ${humanize(p.roleKey).toLowerCase()}.`} cardTitle="Accept invitation" cardText={session ? `Signed in as ${session.user.email}.` : 'Sign in or create an account with the invited email address.'}>
      {session ? (
        <ActionButton path="/user/invitations/accept" body={{ token }} redirectTo="/app/dashboard">
          Accept and join workspace
        </ActionButton>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <Link href={`/login?next=${encodeURIComponent(here)}`} style={{ fontWeight: 700 }}>
            Sign in to accept →
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(here)}`}>Create an account</Link>
        </div>
      )}
    </AuthCard>
  );
}
