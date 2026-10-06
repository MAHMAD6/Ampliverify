import { SettingsNav } from '@/components/app/SettingsNav';
import { SettingsHeader } from '@/components/app/SettingsHeader';
import p from '@/components/app/pages.module.css';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsHeader />
      <div className={p.settingsLayout}>
        <SettingsNav />
        <div className={p.settingsContent}>{children}</div>
      </div>
    </>
  );
}
