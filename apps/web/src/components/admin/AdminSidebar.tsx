'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calculator, ChevronDown, CreditCard, FileText, Home, Menu, Settings2, SlidersHorizontal, Store, Users, X } from 'lucide-react';
import { ADMIN_NAV } from '@/lib/nav';
import { Logo } from '../brand/Logo';
import s from './admin.module.css';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  command: Home,
  'users-group': Users,
  'content-group': FileText,
  'billing-group': CreditCard,
  'valuation-group': Calculator,
  'marketplace-group': Store,
  'ops-group': Settings2,
  'settings-group': SlidersHorizontal,
};

function matches(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  if (href === '/admin/settings' || href === '/admin/valuation') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Collapsible Super Admin navigation (admin redesign, chat images 2026-10-06). */
export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Below 1080px the sidebar is a drawer; it closes on navigation and with Escape.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);
  return (
    <>
    <button type="button" className={`${s.circle} ${s.menuToggle}`} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="admin-nav" onClick={() => setMobileOpen(true)}>
      <Menu size={20} />
    </button>
    {mobileOpen && <div className={s.backdrop} aria-hidden onClick={() => setMobileOpen(false)} />}
    <aside id="admin-nav" className={`${s.sidebar} ${mobileOpen ? s.sidebarOpen : ''}`} aria-label="Super Admin">
      <div className={s.brand} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Logo href="/admin" onDark tagline="engineering" size={38} />
        <button type="button" className={`${s.circle} ${s.menuClose}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
          <X size={18} />
        </button>
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
    </>
  );
}
