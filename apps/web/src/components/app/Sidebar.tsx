'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  CreditCard,
  FileBarChart,
  FilePenLine,
  Folder,
  Gauge,
  Home,
  Layers,
  Lightbulb,
  Menu,
  Search,
  Settings,
  SquarePen,
  Target,
  Wrench,
  X,
} from 'lucide-react';
import type { NavItem } from '@/lib/nav';
import { Logo } from '../brand/Logo';
import { ButtonLink } from '../ui';
import s from './shell.module.css';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  dashboard: Home,
  projects: Folder,
  audit: SquarePen,
  optimization: Wrench,
  editor: FilePenLine,
  content: Target,
  keywords: Search,
  geo: Layers,
  reports: FileBarChart,
  usage: Gauge,
  billing: CreditCard,
  settings: Settings,
  fallback: BarChart3,
};

function isActive(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <>
      <button className={`${s.iconBtn} ${s.menuToggle}`} style={{ position: 'fixed', top: 14, left: 12, zIndex: 40 }} aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
        <Menu size={22} />
      </button>
      <aside className={`${s.sidebar} ${mobileOpen ? s.sidebarOpen : ''}`} aria-label="Primary">
        <div className={s.brand} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo href="/app" onDark tagline="workflow" size={42} />
          <button className={`${s.iconBtn} ${s.menuToggle}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)} style={{ color: '#fff' }}>
            <X size={20} />
          </button>
        </div>
        <nav className={s.nav}>
          {items.map((item) => {
            const Icon = ICONS[item.key] ?? ICONS.fallback;
            const active = isActive(pathname, item.href) || !!item.children?.some((c) => isActive(pathname, c.href));
            const expanded = open[item.key] ?? (active && !!item.children);
            return (
              <div key={item.key}>
                {item.divider && <div className={s.navDivider} />}
                <div style={{ display: 'flex' }}>
                  <Link
                    href={item.href}
                    className={`${s.navItem} ${active ? s.navActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={22} />
                    <span className={s.navLabel}>{item.label}</span>
                    {item.children && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
                        aria-expanded={expanded}
                        onClick={(e) => {
                          e.preventDefault();
                          setOpen((o) => ({ ...o, [item.key]: !expanded }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpen((o) => ({ ...o, [item.key]: !expanded }));
                          }
                        }}
                        style={{ display: 'inline-flex' }}
                      >
                        <ChevronDown size={18} className={`${s.chevron} ${expanded ? s.chevronOpen : ''}`} />
                      </span>
                    )}
                  </Link>
                </div>
                {item.children && expanded && (
                  <div className={s.children}>
                    {item.children.map((child) => (
                      <Link
                        key={child.href + child.label}
                        href={child.href}
                        className={`${s.child} ${pathname === child.href ? s.childActive : ''}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className={s.promo} style={{ marginTop: 24 }}>
          <div className={s.promoHead}>
            <span className={s.promoIcon}>
              <Lightbulb size={24} />
            </span>
            <div>
              <b>Upgrade your plan</b>
              <p>Get more credits, higher limits, and advanced features.</p>
            </div>
          </div>
          <ButtonLink href="/app/billing" block>
            Upgrade Plan
          </ButtonLink>
        </div>
        <div className={s.copyright}>
          © {new Date().getFullYear()} AmpliVerify Inc.
          <br />
          All rights reserved.
        </div>
      </aside>
    </>
  );
}
