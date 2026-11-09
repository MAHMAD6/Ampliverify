'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Briefcase, Building2, Calculator, ChevronDown, ClipboardCheck, FileSearch, HelpCircle, LayoutGrid, LineChart, Mail, Menu as MenuIcon, Newspaper, PackagePlus, PenSquare, Search, ShoppingBag, Sparkles, Store, TrendingUp, Workflow, X } from 'lucide-react';
import { Brand } from './Brand';
import h from './header.module.css';

type Item = { label: string; href: string; icon: React.ReactNode; text: string };
type Menu = { key: string; label: string; items: Item[] };
type Entry = { label: string; href: string } | Menu;

/** Header order (V2 guide §4.2): Home | Features | Asset Tools | Marketplace | Pricing | Resources | Company. */
const NAV: Entry[] = [
  { label: 'Home', href: '/' },
  {
    key: 'features',
    label: 'Features',
    items: [
      { label: 'All Features', href: '/features', icon: <LayoutGrid size={18} />, text: 'Everything in the SEO workspace' },
      { label: 'On-Page SEO Audit', href: '/seo-audit', icon: <Search size={18} />, text: 'Find technical and on-page issues' },
      { label: 'SEO Editor', href: '/seo-editor', icon: <PenSquare size={18} />, text: 'Optimize pages with live guidance' },
      { label: 'GEO / AI Search', href: '/geo-ai-search', icon: <Sparkles size={18} />, text: 'Visibility in AI answers' },
      { label: 'Content Audit', href: '/content-audit', icon: <FileSearch size={18} />, text: 'Review content quality at scale' },
    ],
  },
  {
    key: 'asset-tools',
    label: 'Asset Tools',
    items: [
      { label: 'Asset Tools Overview', href: '/asset-tools', icon: <Briefcase size={18} />, text: 'Manage websites as digital assets' },
      { label: 'Website Value Calculator', href: '/website-value', icon: <Calculator size={18} />, text: 'Free estimate of a site’s value' },
      { label: 'Acquisition Analysis', href: '/asset-tools/acquisition-analysis', icon: <ClipboardCheck size={18} />, text: 'Check a site before you buy' },
      { label: 'Asset Optimization', href: '/asset-tools/asset-optimization', icon: <TrendingUp size={18} />, text: 'Plan improvements that add value' },
      { label: 'Valuation & Performance', href: '/asset-tools/valuation-performance', icon: <LineChart size={18} />, text: 'Track value and earnings over time' },
    ],
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    items: [
      { label: 'Marketplace Overview', href: '/marketplace', icon: <Store size={18} />, text: 'Buy and sell digital assets' },
      { label: 'Browse Listings', href: '/marketplace/listings', icon: <ShoppingBag size={18} />, text: 'Reviewed websites and products' },
      { label: 'Sell a Digital Asset', href: '/sell', icon: <PackagePlus size={18} />, text: 'List a website or digital product' },
      { label: 'How the Marketplace Works', href: '/marketplace/how-it-works', icon: <Workflow size={18} />, text: 'Verification, offers and delivery' },
      { label: 'Marketplace FAQ', href: '/marketplace/faq', icon: <HelpCircle size={18} />, text: 'Common buyer and seller questions' },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  {
    key: 'resources',
    label: 'Resources',
    items: [
      { label: 'How It Works', href: '/how-it-works', icon: <Workflow size={18} />, text: 'From audit to verified results' },
      { label: 'Blog', href: '/blog', icon: <Newspaper size={18} />, text: 'SEO insights and product updates' },
      { label: 'Guides', href: '/guides', icon: <BookOpen size={18} />, text: 'Practical, step-by-step playbooks' },
      { label: 'Help Center', href: '/help', icon: <HelpCircle size={18} />, text: 'Answers and how-tos' },
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
const isMenu = (e: Entry): e is Menu => 'items' in e;

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
          {NAV.map((m) => {
            if (!isMenu(m))
              return (
                <Link key={m.href} href={m.href} className={`${h.link} ${on(m.href) ? h.active : ''}`} aria-current={on(m.href) ? 'page' : undefined}>
                  {m.label}
                </Link>
              );
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
            {mobile ? <X size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>
      </div>

      <div id="mobile-menu" className={h.mobile} data-open={mobile} aria-hidden={!mobile}>
        <div className={h.mobileInner}>
          {NAV.map((m) => {
            if (!isMenu(m))
              return (
                <Link key={m.href} href={m.href} className={`${h.mLink} ${on(m.href) ? h.mOn : ''}`} tabIndex={mobile ? 0 : -1}>
                  {m.label}
                </Link>
              );
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
