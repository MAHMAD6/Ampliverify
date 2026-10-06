import Link from 'next/link';
import { Logo } from '../brand/Logo';
import { ButtonLink } from '../ui';
import s from './public.module.css';

const NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Resources' },
  { href: '/about', label: 'Company' },
];

export function SiteHeader() {
  return (
    <header className={s.header}>
      <Logo tagline="engineering" />
      <nav className={s.nav} aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className={s.headerActions}>
        <Link href="/app" className={s.signin}>
          Sign In
        </Link>
        <ButtonLink href="/app" variant="green">
          Get Started Free
        </ButtonLink>
      </div>
    </header>
  );
}
