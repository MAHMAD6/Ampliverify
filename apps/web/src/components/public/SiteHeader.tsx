'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown, Menu } from 'lucide-react';
import { Brand } from './Brand';
import s from './site.module.css';

const RESOURCES = [
  ['Blog', '/blog'],
  ['Guides', '/guides'],
  ['Help Center', '/help'],
] as const;
const COMPANY = [
  ['About Us', '/about'],
  ['Careers', '/careers'],
  ['Contact', '/contact'],
] as const;

/** Public header (public-website-v2). Dropdowns use <details> so they work without JavaScript. */
export function SiteHeader() {
  const path = usePathname();
  const on = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
  const group = (title: string, links: readonly (readonly [string, string])[]) => (
    <details className={`${s.navMenu} ${links.some(([, h]) => on(h)) ? s.on : ''}`}>
      <summary>
        {title} <ChevronDown size={15} />
      </summary>
      <div>
        {links.map(([l, h]) => (
          <Link key={h} href={h}>
            {l}
          </Link>
        ))}
      </div>
    </details>
  );
  const links = (
    <>
      {(
        [
          ['Home', '/'],
          ['Features', '/features'],
          ['How It Works', '/how-it-works'],
          ['Pricing', '/pricing'],
        ] as const
      ).map(([l, h]) => (
        <Link key={h} href={h} className={on(h) ? s.on : undefined} aria-current={on(h) ? 'page' : undefined}>
          {l}
        </Link>
      ))}
      {group('Resources', RESOURCES)}
      {group('Company', COMPANY)}
    </>
  );
  return (
    <header className={s.header}>
      <div className={`${s.container} ${s.headerIn}`}>
        <Brand />
        <nav className={s.nav} aria-label="Main">
          {links}
        </nav>
        <Link href="/login" className={s.login}>
          Log In
        </Link>
        <Link href="/signup" className={`${s.btn} ${s.sm}`}>
          Get Started Free <ArrowRight size={18} />
        </Link>
        <details className={s.menuBtn}>
          <summary aria-label="Open menu" style={{ listStyle: 'none', cursor: 'pointer' }}>
            <Menu size={22} />
          </summary>
          <div style={{ position: 'absolute', right: 20, top: 72, background: '#fff', border: '1px solid #e3e9e5', borderRadius: 12, padding: 12, display: 'grid', gap: 8, minWidth: 220 }}>
            {[['Home', '/'], ['Features', '/features'], ['How It Works', '/how-it-works'], ['Pricing', '/pricing'], ...RESOURCES, ...COMPANY, ['Log In', '/login']].map(([l, h]) => (
              <Link key={h} href={h} style={{ color: '#0b1b35', padding: '6px 8px' }}>
                {l}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </header>
  );
}
