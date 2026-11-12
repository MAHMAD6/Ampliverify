import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, CircleHelp, Search } from 'lucide-react';
import { BUYER_NAV_GROUPS } from '@/lib/nav';
import { initials } from '@/lib/format';
import type { Me } from '@/lib/types';
import { AccountMenu } from '../app/AccountMenu';
import { Sidebar } from '../app/Sidebar';
import { Input } from '../ui';
import { MarketFooter } from './MarketFooter';
import s from '../app/shell.module.css';

/**
 * Marketplace (Buyer / Seller) layout: its own sidebar without SEO tools,
 * credits or plan upsells (V2 guide §3.1). Seller sections appear only for
 * users who have started selling; the API enforces every permission.
 */
export function MarketShell({ me, unread = 0, children }: { me: Me | null; unread?: number; children: ReactNode }) {
  const seller = !!me?.seller && me.seller.status !== 'SUSPENDED';
  return (
    <div className={s.app}>
      <Sidebar groups={BUYER_NAV_GROUPS} seller={seller} home="/buyer" tagline="workflow" footer={<MarketFooter seller={seller} />} />
      <div className={s.main}>
        <header className={s.topbar}>
          <form className={s.search} action="/buyer/browse" role="search">
            <Input name="q" icon={<Search size={18} />} placeholder="Search assets, websites, or sellers..." aria-label="Search the Marketplace" />
          </form>
          <div className={s.topRight}>
            <Link href="/buyer/support" className={s.iconBtn} aria-label="Support">
              <CircleHelp size={22} />
            </Link>
            <Link href="/buyer/notifications" className={s.iconBtn} aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'} style={{ position: 'relative' }}>
              <Bell size={22} />
              {unread > 0 && (
                <span
                  aria-hidden
                  style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--red, #dc2626)', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center' }}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <AccountMenu name={me?.displayName} email={me?.email} initials={me ? initials(me.displayName, me.email) : undefined} />
          </div>
        </header>
        <main className={s.content}>{children}</main>
      </div>
    </div>
  );
}
