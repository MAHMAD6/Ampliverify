import { Panel, Stack } from '@/components/ui';
import { ProfileForm } from '@/components/app/settings/AccountSecurity';
import { getAppContext } from '@/lib/project';
import { getSession } from '@/lib/session';

export const metadata = { title: 'My Profile · Marketplace' };

export default async function BuyerProfilePage() {
  const [{ me }, session] = await Promise.all([getAppContext(), getSession()]);
  return (
    <Stack>
      <Panel title="Profile Information" description="Sellers see your display name, never your email address.">
        <ProfileForm name={me?.displayName ?? session?.user.name ?? ''} email={me?.email ?? session?.user.email ?? ''} />
      </Panel>
    </Stack>
  );
}
