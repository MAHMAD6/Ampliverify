'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MARKETPLACE_GROUPS } from './MarketplaceLauncher';
import s from './market.module.css';

const LINKS = MARKETPLACE_GROUPS.flatMap((g): readonly { label: string; href: string }[] => g.items);

/** Marketplace section navigation with a way back to the SEO workspace. */
export function MarketNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === '/app/marketplace' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <div className={s.navBar}>
      <Link href="/app/dashboard" className={s.back}>
        <ArrowLeft size={16} aria-hidden /> Back to workspace
      </Link>
      <nav className={s.tabs} aria-label="Marketplace">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`${s.tab} ${active(l.href) ? s.tabActive : ''}`} aria-current={active(l.href) ? 'page' : undefined}>
            {l.label.replace('Marketplace ', '')}
          </Link>
        ))}
      </nav>
    </div>
  );
}
