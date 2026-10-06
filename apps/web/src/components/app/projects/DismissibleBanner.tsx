'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import s from './projects.module.css';

/** Banner the user can hide; the choice is remembered in this browser only. */
export function DismissibleBanner({ id, children }: { id: string; children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(`av-dismissed:${id}`) === '1');
    } catch {
      // storage unavailable: keep visible
    }
  }, [id]);
  if (hidden) return null;
  return (
    <div className={s.banner} role="note">
      {children}
      <button
        className={s.bannerClose}
        aria-label="Dismiss"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(`av-dismissed:${id}`, '1');
          } catch {
            // ignore
          }
        }}
      >
        <X size={20} />
      </button>
    </div>
  );
}
