'use client';

import { usePathname } from 'next/navigation';
import { TabNav } from '@/components/ui';

const TABS = [
  { key: 'profile', label: 'My Profile', href: '/buyer/settings/profile' },
  { key: 'security', label: 'Security & Password', href: '/buyer/settings/security' },
  { key: 'notifications', label: 'Notifications', href: '/buyer/settings/notifications' },
  { key: 'privacy', label: 'Privacy Preferences', href: '/buyer/settings/privacy' },
];

export function TabNavClient() {
  const pathname = usePathname();
  const active = TABS.find((t) => pathname.startsWith(t.href))?.key ?? 'profile';
  return <TabNav tabs={TABS} active={active} />;
}
