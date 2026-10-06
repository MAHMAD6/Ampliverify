import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import s from './site.module.css';

export function Checks({ items }: { items: string[] }) {
  return (
    <div className={s.checks}>
      {items.map((i) => (
        <span key={i}>
          <Check size={18} /> {i}
        </span>
      ))}
    </div>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className={s.list}>
      {items.map((i) => (
        <li key={i}>
          <Check size={18} /> {i}
        </li>
      ))}
    </ul>
  );
}

/** Centered page hero on the mint gradient. */
export function PageHero({ eyebrow, title, lead, center = false, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean; children?: ReactNode }) {
  return (
    <section className={s.hero}>
      <div className={`${s.container} ${center ? s.center : ''}`}>
        <div className={s.eyebrow}>{eyebrow}</div>
        <h1 className={s.h1}>{title}</h1>
        {lead && <p className={s.lead}>{lead}</p>}
        {children}
      </div>
    </section>
  );
}

export function CtaBand({ eyebrow, title, text, primary = { label: 'Get Started Free', href: '/signup' }, secondary }: { eyebrow?: string; title: string; text: string; primary?: { label: string; href: string }; secondary?: { label: string; href: string } }) {
  return (
    <section className={s.section}>
      <div className={s.container}>
        <div className={s.cta}>
          {eyebrow && <div className={s.eyebrow}>{eyebrow}</div>}
          <h2 className={s.h2}>{title}</h2>
          <p className={s.lead} style={{ margin: '0 auto' }}>
            {text}
          </p>
          <div className={s.heroActions} style={{ justifyContent: 'center' }}>
            <Link href={primary.href} className={s.btn}>
              {primary.label} <ArrowRight size={18} />
            </Link>
            {secondary && (
              <Link href={secondary.href} className={s.btnOutline}>
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function LearnMore({ href, children = 'Learn More' }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className={s.learn}>
      {children} <ArrowRight size={16} />
    </Link>
  );
}

/** Decorative trend line used on article covers (no data). */
export function TrendArt({ dark = false }: { dark?: boolean }) {
  return (
    <svg viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden>
      <path d="M0 140 L80 125 L140 130 L210 95 L270 100 L340 65 L400 45 L400 160 L0 160 Z" fill={dark ? '#0b4f24' : '#d6efdc'} />
      <path d="M0 140 L80 125 L140 130 L210 95 L270 100 L340 65 L400 45" fill="none" stroke={dark ? '#7fd49a' : '#15803d'} strokeWidth="3" />
    </svg>
  );
}
