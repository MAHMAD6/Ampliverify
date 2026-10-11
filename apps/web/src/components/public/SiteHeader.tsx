'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, BookOpen, Calculator, ChevronDown, HelpCircle, Menu, Newspaper, Search } from 'lucide-react';
import { Brand } from './Brand';
import s from './site.module.css';

const RESOURCES = [
  ['Blog', '/blog', <Newspaper key="b" size={16} />],
  ['Guides', '/guides', <BookOpen key="g" size={16} />],
  ['Help Center', '/help', <HelpCircle key="h" size={16} />],
  ['Website Value Calculator', '/website-value', <Calculator key="w" size={16} />],
] as const;
const COMPANY = [
  ['About Us', '/about'],
  ['Careers', '/careers'],
  ['Contact', '/contact'],
] as const;
const MAIN = [
  ['Home', '/'],
  ['Features', '/features'],
  ['How It Works', '/how-it-works'],
  ['Pricing', '/pricing'],
] as const;

/** Public header (Public_Frontend designs). Dropdowns use <details> so they work without JavaScript. */
export function SiteHeader() {
  const path = usePathname();
  const on = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
  return (
    <header className={s.header}>
      <div className={`${s.container} ${s.headerIn}`}>
        <Brand />
        <nav className={s.nav} aria-label="Main">
          {MAIN.map(([l, h]) => (
            <Link key={h} href={h} className={on(h) ? s.on : undefined} aria-current={on(h) ? 'page' : undefined}>
              {l}
            </Link>
          ))}
          <details className={`${s.navMenu} ${RESOURCES.some(([, h]) => on(h)) ? s.on : ''}`}>
            <summary>
              Resources <ChevronDown size={15} />
            </summary>
            <div>
              {RESOURCES.map(([l, h, icon]) => (
                <Link key={h} href={h}>
                  {icon} {l}
                </Link>
              ))}
            </div>
          </details>
          <details className={`${s.navMenu} ${COMPANY.some(([, h]) => on(h)) ? s.on : ''}`}>
            <summary>
              Company <ChevronDown size={15} />
            </summary>
            <div>
              {COMPANY.map(([l, h]) => (
                <Link key={h} href={h}>
                  {l}
                </Link>
              ))}
            </div>
          </details>
        </nav>
        <Link href="/blog#search" className={s.searchLink} aria-label="Search articles">
          <Search size={20} />
        </Link>
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
          <div className={s.mobileMenu}>
            {[...MAIN, ...RESOURCES.map(([l, h]) => [l, h] as const), ...COMPANY, ['Log In', '/login'] as const].map(([l, h]) => (
              <Link key={h} href={h}>
                {l}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </header>
  );
}
