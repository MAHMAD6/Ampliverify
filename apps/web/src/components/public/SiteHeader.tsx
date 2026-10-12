'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Briefcase, Building2, Calculator, ChevronDown, HelpCircle, Mail, Menu, Newspaper, Search, X } from 'lucide-react';
import { Brand } from './Brand';
import h from './header.module.css';

type Item = { label: string; href: string; icon: React.ReactNode; text: string };

const MAIN = [
  ['Home', '/'],
  ['Features', '/features'],
  ['How It Works', '/how-it-works'],
  ['Pricing', '/pricing'],
] as const;

const MENUS: { key: string; label: string; items: Item[] }[] = [
  {
    key: 'resources',
    label: 'Resources',
    items: [
      { label: 'Blog', href: '/blog', icon: <Newspaper size={18} />, text: 'SEO insights and product updates' },
      { label: 'Guides', href: '/guides', icon: <BookOpen size={18} />, text: 'Practical, step-by-step playbooks' },
      { label: 'Help Center', href: '/help', icon: <HelpCircle size={18} />, text: 'Answers and how-tos' },
      { label: 'Website Value Calculator', href: '/website-value', icon: <Calculator size={18} />, text: 'Free estimate of your site’s value' },
    ],
  },
  {
    key: 'company',
    label: 'Company',
    items: [
      { label: 'About Us', href: '/about', icon: <Building2 size={18} />, text: 'Our story and approach' },
      { label: 'Careers', href: '/careers', icon: <Briefcase size={18} />, text: 'Open roles' },
      { label: 'Contact', href: '/contact', icon: <Mail size={18} />, text: 'Talk to our team' },
    ],
  },
];

/**
 * Public header: sticky with a shadow once scrolled; desktop dropdowns open on
 * hover (with a short close delay), click or keyboard and close on outside
 * click / Escape; the mobile menu slides down with expandable sections.
 */
export function SiteHeader() {
  const path = usePathname();
  const on = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  }, []);

  // Close everything on navigation.
  useEffect(() => {
    setOpen(null);
    setMobile(false);
    setSection(null);
  }, [path]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setMobile(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  // Lock page scroll behind the open mobile menu.
  useEffect(() => {
    document.documentElement.style.overflow = mobile ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [mobile]);

  return (
    <header className={`${h.header} ${scrolled || mobile ? h.scrolled : ''}`}>
      <div className={h.inner}>
        <Brand />
        <nav ref={navRef} className={h.nav} aria-label="Main">
          {MAIN.map(([l, href]) => (
            <Link key={href} href={href} className={`${h.link} ${on(href) ? h.active : ''}`} aria-current={on(href) ? 'page' : undefined}>
              {l}
            </Link>
          ))}
          {MENUS.map((m) => {
            const isOpen = open === m.key;
            const activeGroup = m.items.some((i) => on(i.href));
            return (
              <div
                key={m.key}
                className={h.menu}
                onMouseEnter={() => {
                  cancelClose();
                  setOpen(m.key);
                }}
                onMouseLeave={closeSoon}
              >
                <button
                  type="button"
                  className={`${h.link} ${activeGroup ? h.active : ''}`}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpen(isOpen ? null : m.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setOpen(m.key);
                      requestAnimationFrame(() => (document.querySelector(`#menu-${m.key} a`) as HTMLElement | null)?.focus());
                    }
                  }}
                >
                  {m.label} <ChevronDown size={15} className={h.chevron} data-open={isOpen} />
                </button>
                <div id={`menu-${m.key}`} className={h.panel} data-open={isOpen} role="menu">
                  {m.items.map((i) => (
                    <Link key={i.href} href={i.href} role="menuitem" className={`${h.item} ${on(i.href) ? h.itemOn : ''}`} tabIndex={isOpen ? 0 : -1} onClick={() => setOpen(null)}>
                      <span className={h.itemIcon}>{i.icon}</span>
                      <span>
                        <b>{i.label}</b>
                        <small>{i.text}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className={h.actions}>
          <Link href="/blog#search" className={h.icon} aria-label="Search articles">
            <Search size={20} />
          </Link>
          <Link href="/login" className={h.login}>
            Log In
          </Link>
          <Link href="/signup" className={h.cta}>
            Get Started Free <ArrowRight size={18} />
          </Link>
          <button type="button" className={h.burger} aria-label={mobile ? 'Close menu' : 'Open menu'} aria-expanded={mobile} aria-controls="mobile-menu" onClick={() => setMobile(!mobile)}>
            {mobile ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <div id="mobile-menu" className={h.mobile} data-open={mobile} aria-hidden={!mobile}>
        <div className={h.mobileInner}>
          {MAIN.map(([l, href]) => (
            <Link key={href} href={href} className={`${h.mLink} ${on(href) ? h.mOn : ''}`} tabIndex={mobile ? 0 : -1}>
              {l}
            </Link>
          ))}
          {MENUS.map((m) => {
            const isOpen = section === m.key;
            return (
              <div key={m.key} className={h.mGroup}>
                <button type="button" className={h.mLink} aria-expanded={isOpen} tabIndex={mobile ? 0 : -1} onClick={() => setSection(isOpen ? null : m.key)}>
                  {m.label} <ChevronDown size={18} className={h.chevron} data-open={isOpen} />
                </button>
                <div className={h.mSub} data-open={isOpen}>
                  <div>
                    {m.items.map((i) => (
                      <Link key={i.href} href={i.href} className={`${h.mSubLink} ${on(i.href) ? h.mOn : ''}`} tabIndex={mobile && isOpen ? 0 : -1}>
                        <span className={h.itemIcon}>{i.icon}</span> {i.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div className={h.mActions}>
            <Link href="/login" className={h.mLogin} tabIndex={mobile ? 0 : -1}>
              Log In
            </Link>
            <Link href="/signup" className={h.cta} tabIndex={mobile ? 0 : -1}>
              Get Started Free <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
      <div className={h.scrim} data-open={mobile} onClick={() => setMobile(false)} aria-hidden />
    </header>
  );
}
