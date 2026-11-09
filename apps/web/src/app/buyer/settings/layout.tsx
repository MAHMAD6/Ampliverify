import { PageHeader } from '@/components/ui';
import { TabNavClient } from './tabs';

export default function BuyerSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Account Settings" description="Your profile, sign-in security, notifications and privacy. These apply to your whole AmpliVerify account." />
      <TabNavClient />
      <div style={{ marginTop: 16 }}>{children}</div>
    </>
  );
}
