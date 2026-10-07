import Link from 'next/link';
import { Bell, CircleHelp, Search } from 'lucide-react';
import { initials } from '@/lib/format';
import type { Me, Project } from '@/lib/types';
import { Input } from '../ui';
import { AccountMenu } from './AccountMenu';
import { ProjectPicker } from './ProjectPicker';
import s from './shell.module.css';

export function Topbar({ me, projects, selectedId, unread = 0 }: { me: Me | null; projects: Project[]; selectedId?: string; unread?: number }) {
  return (
    <header className={s.topbar}>
      <span className={s.projectLabel}>Project</span>
      <ProjectPicker projects={projects} selectedId={selectedId} className={s.projectSelect} />
      <form className={s.search} action="/app/search" role="search">
        <Input name="q" icon={<Search size={18} />} placeholder="Search projects, keywords, or help..." aria-label="Search" />
      </form>
      <div className={s.topRight}>
        <Link href="/app/help" className={s.iconBtn} aria-label="Help & Support">
          <CircleHelp size={22} />
        </Link>
        <Link href="/app/notifications" className={s.iconBtn} aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'} style={{ position: 'relative' }}>
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
  );
}
