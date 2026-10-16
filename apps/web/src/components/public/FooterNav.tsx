'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import s from './site.module.css';

/** Footer link column; the link for the current page is highlighted. */
export function FooterNav({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  const path = usePathname();
  const params = useSearchParams();
  const here = `${path}${params.get('doc') ? `?doc=${params.get('doc')}` : ''}`;
  return (
    <nav aria-label={title}>
      <h4>{title}</h4>
      {links.map(([label, href]) => {
        const active = href === here || (href !== '/' && !href.includes('?') && path.startsWith(`${href}/`));
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={active ? s.footerActive : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
