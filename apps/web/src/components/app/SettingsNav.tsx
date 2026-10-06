'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CreditCard, Folder, Link2, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
import p from './pages.module.css';

const ITEMS = [
  { href: '/app/settings/account', label: 'Account', icon: UserRound },
  { href: '/app/settings/workspace', label: 'Workspace', icon: Users },
  { href: '/app/settings/project-defaults', label: 'Project Defaults', icon: Folder },
  { href: '/app/settings/integrations', label: 'Integrations', icon: Link2 },
  { href: '/app/settings/ai-geo', label: 'AI & GEO Preferences', icon: Sparkles },
  { href: '/app/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/app/billing', label: 'Billing & Plan', icon: CreditCard },
  { href: '/app/settings/data-privacy', label: 'Data & Privacy', icon: ShieldCheck },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className={p.settingsNav} aria-label="Settings">
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={pathname === href ? p.settingsNavActive : undefined} aria-current={pathname === href ? 'page' : undefined}>
          <Icon size={20} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
