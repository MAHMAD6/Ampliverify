import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bell, CircleHelp, Search } from 'lucide-react';
import { initials } from '@/lib/format';
import type { Me } from '@/lib/types';
import { Input } from '../ui';
import { AdminSidebar } from './AdminSidebar';
import s from './admin.module.css';

export function AdminShell({ me, children }: { me: Me | null; children: ReactNode }) {
  return (
    <div className={s.app}>
      <AdminSidebar />
      <div className={s.main}>
        <header className={s.topbar}>
          <form className={s.search} action="/admin/search" role="search">
            <Input name="q" icon={<Search size={18} />} placeholder="Search users, content, billing, settings, or pages..." aria-label="Search admin" />
          </form>
          <div className={s.topRight}>
            <Link href="/help" className={s.circle} aria-label="Help">
              <CircleHelp size={18} />
            </Link>
            <Link href="/admin/activity" className={s.circle} aria-label="Admin activity">
              <Bell size={18} />
            </Link>
            <span className={`${s.circle} ${s.avatar}`}>{me ? initials(me.displayName, me.email) : 'SA'}</span>
            <div className={s.profile}>
              <b>{me?.displayName ?? me?.email ?? 'Super Admin'}</b>
              {me ? me.email : 'Not signed in'}
            </div>
          </div>
        </header>
        <main className={s.content}>{children}</main>
      </div>
    </div>
  );
}
