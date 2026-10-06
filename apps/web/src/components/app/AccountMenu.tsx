'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleUserRound, LogOut, Rocket, Settings, ShieldCheck } from 'lucide-react';
import s from './shell.module.css';

export function AccountMenu({ name, email, initials, adminLink }: { name?: string | null; email?: string | null; initials?: string; adminLink?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className={s.account} ref={ref}>
      <button className={s.accountBtn} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={s.avatar}>{initials ?? <CircleUserRound size={22} />}</span>
        Account
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <div className={s.menuHead}>
            <strong>{name ?? email ?? 'Not signed in'}</strong>
            {email && name ? email : null}
          </div>
          <Link href="/app/settings/account" role="menuitem" onClick={() => setOpen(false)}>
            <Settings size={16} /> Account settings
          </Link>
          <Link href="/app/getting-started" role="menuitem" onClick={() => setOpen(false)}>
            <Rocket size={16} /> Getting started
          </Link>
          {adminLink && (
            <Link href="/admin" role="menuitem" onClick={() => setOpen(false)}>
              <ShieldCheck size={16} /> Super Admin
            </Link>
          )}
          <button role="menuitem" disabled title="Sign-in is not connected yet">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
