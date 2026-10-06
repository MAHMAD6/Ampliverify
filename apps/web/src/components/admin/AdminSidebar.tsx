'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Briefcase,
  CreditCard,
  FileText,
  Flag,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  LibraryBig,
  Newspaper,
  Receipt,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  UserCog,
  Users,
  Wallet,
  ArrowLeftRight,
  Home,
  Tags,
  UserPen,
  PlayCircle,
  CalendarDays,
  Layers,
} from 'lucide-react';
import { ADMIN_NAV } from '@/lib/nav';
import { Logo } from '../brand/Logo';
import s from './admin.module.css';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  command: Home,
  users: Users,
  admins: ShieldCheck,
  'sub-admins': UserCog,
  roles: KeyRound,
  access: ArrowLeftRight,
  content: LayoutGrid,
  blog: Newspaper,
  resources: LibraryBig,
  media: ImageIcon,
  careers: Briefcase,
  plans: BadgeCheck,
  entitlements: SlidersHorizontal,
  subscriptions: CreditCard,
  invoices: Receipt,
  credits: Wallet,
  modules: ToggleLeft,
  flags: Flag,
  usage: BarChart3,
  health: Activity,
  activity: FileText,
  security: Shield,
  settings: Settings,
  gauge: Gauge,
  categories: Tags,
  authors: UserPen,
  videos: PlayCircle,
  events: CalendarDays,
  'case-studies': Layers,
};

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className={s.sidebar} aria-label="Super Admin">
      <div className={s.brand}>
        <Logo href="/admin" onDark tagline="engineering" size={38} />
      </div>
      <nav>
        {ADMIN_NAV.map((group, i) => (
          <div key={group.section ?? i}>
            {group.section && <div className={s.section}>{group.section}</div>}
            {group.items.map((item) => {
              const Icon = ICONS[item.key] ?? Gauge;
              const active = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.key} href={item.href} className={`${s.item} ${active ? s.active : ''}`} aria-current={active ? 'page' : undefined}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
