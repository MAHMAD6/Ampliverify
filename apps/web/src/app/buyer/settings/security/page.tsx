import { AccountSecurity } from '@/components/app/settings/AccountSecurity';
import { getPlatformInfo } from '@/lib/platform';
import { getSession } from '@/lib/session';

export const metadata = { title: 'Security & Password · Marketplace' };

export default async function BuyerSecurityPage() {
  const [session, platform] = await Promise.all([getSession(), getPlatformInfo()]);
  const twoFactorEnabled = !!(session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled;
  return <AccountSecurity twoFactorEnabled={twoFactorEnabled} passkeysAllowed={platform.allowPasskeys} />;
}
