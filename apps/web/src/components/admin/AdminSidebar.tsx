'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, CreditCard, FileText, Home, Settings2, SlidersHorizontal, Users } from 'lucide-react';
import { ADMIN_NAV } from '@/lib/nav';
import { Logo } from '../brand/Logo';
import s from './admin.module.css';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  command: Home,
  'users-group': Users,
  'content-group': FileText,
  'billing-group': CreditCard,
  'ops-group': Settings2,
  'settings-group': SlidersHorizontal,
};

function matches(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  if (href === '/admin/settings') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Collapsible Super Admin navigation (admin redesign, chat images 2026-10-06). */
export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <aside className={s.sidebar} aria-label="Super Admin">
      <div className={s.brand}>
        <Logo href="/admin" onDark tagline="engineering" size={38} />
      </div>
      <nav>
        {ADMIN_NAV.map((group) => {
          const Icon = ICONS[group.key] ?? Home;
          if (group.href) {
            const active = matches(pathname, group.href);
            return (
              <Link key={group.key} href={group.href} className={`${s.group} ${active ? s.active : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon size={20} />
                {group.label}
              </Link>
            );
          }
          // Longest matching href wins, so /admin/admins/detail does not also light up Admins.
          const best = group.items!.filter((i) => matches(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0];
          const expanded = open[group.key] ?? !!best;
          return (
            <div key={group.key}>
              <button type="button" className={`${s.group} ${best ? s.groupActive : ''}`} aria-expanded={expanded} onClick={() => setOpen((o) => ({ ...o, [group.key]: !expanded }))}>
                <Icon size={20} />
                <span>{group.label}</span>
                <ChevronDown size={16} className={s.chev} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
              </button>
              {expanded && (
                <div className={s.children}>
                  {group.items!.map((item) => {
                    const active = item === best;
                    return (
                      <Link key={item.key} href={item.href} className={`${s.child} ${active ? s.active : ''}`} aria-current={active ? 'page' : undefined}>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
