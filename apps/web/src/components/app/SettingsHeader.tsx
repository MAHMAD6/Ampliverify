'use client';

import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { APP_NAV, appCrumbs } from '@/lib/nav';

const SETTINGS = APP_NAV.find((i) => i.key === 'settings')!.children!;

/** Settings header with the breadcrumb trail for the current sub-page (navigation-batch1/06). */
export function SettingsHeader() {
  const pathname = usePathname();
  const page = SETTINGS.find((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
  return (
    <PageHeader
      title="Settings"
      description="Manage your account, workspace, integrations, preferences, and more."
      crumbs={appCrumbs({ label: 'Settings', href: '/app/settings/account' }, ...(page ? [{ label: page.label }] : []))}
    />
  );
}
