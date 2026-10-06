'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '../ui';
import s from './addmenu.module.css';

/** Primary action with a dropdown of options; options are disabled with a reason until their API exists. */
export function AddMenu({ label, items }: { label: string; items: { title: string; text: string; icon: React.ReactNode; disabledReason?: string; href?: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className={s.wrap} ref={ref}>
      <Button icon={<Plus size={18} />} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <ChevronDown size={16} />
      </Button>
      {open && (
        <div className={s.menu} role="menu">
          {items.map((i) =>
            i.href && !i.disabledReason ? (
              <a key={i.title} href={i.href} role="menuitem" className={s.item}>
                {i.icon}
                <span>
                  <b>{i.title}</b>
                  <small>{i.text}</small>
                </span>
              </a>
            ) : (
              <button key={i.title} type="button" role="menuitem" className={s.item} disabled title={i.disabledReason}>
                {i.icon}
                <span>
                  <b>{i.title}</b>
                  <small>{i.disabledReason ?? i.text}</small>
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
