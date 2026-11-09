'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Download,
  FileBarChart,
  FilePenLine,
  FileSearch,
  Folder,
  FolderKanban,
  Gauge,
  Heart,
  Home,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Link2,
  LifeBuoy,
  Menu,
  MessageSquare,
  Activity,
  PackagePlus,
  Plug,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  SquarePen,
  Store,
  Tags,
  Target,
  TrendingUp,
  Wallet,
  Wrench,
  X,
  Database,
  Landmark,
  FileText,
  ShieldAlert,
  Handshake,
  UserRound,
  ShieldCheck,
  Inbox,
} from 'lucide-react';
import type { NavGroup, NavItem } from '@/lib/nav';
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
  'content-audit': FileSearch,
  valuation: Calculator,
  'assets-dashboard': LayoutDashboard,
  portfolio: Briefcase,
  'asset-new': PackagePlus,
  acquisitions: ClipboardCheck,
  improvement: TrendingUp,
  'asset-projects': FolderKanban,
  'asset-performance': BarChart3,
  'market-buyer': Store,
  'market-browse': Search,
  'market-sell': PackagePlus,
  'market-listings': Tags,
  'market-inquiries': MessageSquare,
  'market-purchases': ShoppingBag,
  'market-transactions': ArrowRightLeft,
  'market-messages': MessageSquare,
  'market-seller': Wrench,
  'integrations-dashboard': Plug,
  'connected-accounts': Link2,
  'data-connections': Database,
  'connection-activity': Activity,
  'fin-overview': Wallet,
  'fin-earnings': TrendingUp,
  'fin-payouts': Landmark,
  'fin-methods': CreditCard,
  'fin-refunds': ShieldAlert,
  'fin-tax': FileText,
  guides: BookOpen,
  support: LifeBuoy,
  saved: Heart,
  downloads: Download,
  receipt: Receipt,
  'buyer-dashboard': LayoutDashboard,
  offers: Handshake,
  'seller-dashboard': LayoutDashboard,
  'seller-profile': UserRound,
  verification: ShieldCheck,
  'seller-inquiries': Inbox,
  fallback: BarChart3,
};

function isActive(pathname: string, href: string, exact = false) {
  return href === '/app' || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** `footer` replaces the default upgrade promo (the Marketplace shell has no SEO upsells); `home` is the logo link. */
export function Sidebar({ groups, launcher, seller = false, footer, home = '/app/dashboard', tagline = 'workflow' }: { groups: NavGroup[]; launcher?: ReactNode; seller?: boolean; footer?: ReactNode; home?: string; tagline?: 'workflow' | 'none' | 'engineering' }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const visible = groups.filter((g) => !g.sellerOnly || seller);
  const groupActive = (g: NavGroup) => g.items.some((i) => isActive(pathname, i.href, i.exact) || !!i.children?.some((c) => isActive(pathname, c.href)));
  // A route change from outside the nav (e.g. the Marketplace launcher) closes the mobile drawer too.
  useEffect(() => setMobileOpen(false), [pathname]);


  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
            const Icon = ICONS[item.key] ?? ICONS.fallback;
            const active = isActive(pathname, item.href, item.exact) || !!item.children?.some((c) => isActive(pathname, c.href));
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
          });

  return (
    <>
      <button className={`${s.iconBtn} ${s.menuToggle}`} style={{ position: 'fixed', top: 14, left: 12, zIndex: 40 }} aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
        <Menu size={22} />
      </button>
      <aside className={`${s.sidebar} ${mobileOpen ? s.sidebarOpen : ''}`} aria-label="Primary">
        <div className={s.brand} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo href={home} onDark tagline={tagline} size={42} />
          <button className={`${s.iconBtn} ${s.menuToggle}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)} style={{ color: '#fff' }}>
            <X size={20} />
          </button>
        </div>
        <nav className={s.nav}>
          {visible.map((group) => {
            const gOpen = !group.label || (groupOpen[group.key] ?? true);
            return (
              <div key={group.key} className={group.label ? s.navGroup : undefined}>
                {group.label && (
                  <button type="button" className={`${s.groupHead} ${groupActive(group) ? s.groupHeadActive : ''}`} aria-expanded={gOpen} onClick={() => setGroupOpen((o) => ({ ...o, [group.key]: !gOpen }))}>
                    <span>{group.label}</span>
                    <ChevronDown size={16} className={`${s.chevron} ${gOpen ? s.chevronOpen : ''}`} />
                  </button>
                )}
                {gOpen && renderItems(group.items)}
              </div>
            );
          })}
        </nav>
        {launcher}
        {footer !== undefined ? (
          footer
        ) : (
        <div className={s.promo} style={{ marginTop: 24 }}>
            <div className={s.promoHead}>
              <span className={s.promoIcon}>
                <Lightbulb size={24} />
              </span>
              <div>
                <b>Turn insights into growth.</b>
                <p>Audit. Optimize. Verify. All in one place.</p>
              </div>
            </div>
            <ButtonLink href="/app/billing" block>
              Upgrade Plan
            </ButtonLink>
          </div>
        )}
        <div className={s.copyright}>
          © {new Date().getFullYear()} AmpliVerify.
          <br />
          All rights reserved.
        </div>
      </aside>
    </>
  );
}
