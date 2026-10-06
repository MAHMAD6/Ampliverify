import { SettingsNav } from '@/components/app/SettingsNav';
import { PageHeader } from '@/components/ui';
import p from '@/components/app/pages.module.css';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account, workspace, integrations, preferences, and more." />
      <div className={p.settingsLayout}>
        <SettingsNav />
        <div className={p.settingsContent}>{children}</div>
      </div>
    </>
  );
}
