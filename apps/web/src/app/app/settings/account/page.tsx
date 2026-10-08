import { Panel, Stack, KeyValue } from '@/components/ui';
import { AccountSecurity, ProfileForm } from '@/components/app/settings/AccountSecurity';
import { getAppContext } from '@/lib/project';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api';
import type { WorkspaceView } from '@/lib/app-types';

export const metadata = { title: 'Account · Settings' };

/** Profile, password, MFA, passkeys and sessions (Better Auth), plus workspace locale. */
export default async function AccountSettingsPage() {
  const [{ me, workspaceId }, session] = await Promise.all([getAppContext(), getSession()]);
  const ws = workspaceId ? await apiGet<WorkspaceView>(`/user/workspaces/${workspaceId}`, { auth: true }) : null;
  const twoFactorEnabled = !!(session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled;
  return (
    <>
      <h2>Account</h2>
      <p>Manage your personal account details, security, and sign-in methods.</p>
      <Stack>
        <Panel title="Profile Information" description="Your name appears on reports, tasks and activity.">
          <ProfileForm name={me?.displayName ?? session?.user.name ?? ''} email={me?.email ?? session?.user.email ?? ''} />
        </Panel>
        <AccountSecurity twoFactorEnabled={twoFactorEnabled} />
        <Panel title="Account Preferences" description="Language and timezone are set per workspace (Settings → Workspace).">
          <KeyValue label="Language" value={ws?.ok ? ws.data.language : '—'} />
          <KeyValue label="Timezone" value={ws?.ok ? ws.data.timezone : '—'} />
        </Panel>
      </Stack>
    </>
  );
}
