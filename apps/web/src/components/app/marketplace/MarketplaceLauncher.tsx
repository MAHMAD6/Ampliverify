'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowRightLeft, Banknote, Briefcase, ChevronRight, ClipboardCheck, FileText, FolderOpen, LayoutDashboard, MessageSquare, PackagePlus, Search, ShoppingBag, Store, Tags, Wallet, X } from 'lucide-react';
import s from './launcher.module.css';

/** Launcher destinations (launcher notes §3, V2 guide §2.1): Digital Assets, Marketplace and, for sellers, Finances. */
export const MARKETPLACE_GROUPS = [
  {
    title: 'Digital Assets',
    items: [
      { label: 'Digital Assets Dashboard', href: '/app/assets', icon: Briefcase, exact: true },
      { label: 'My Portfolio', href: '/app/assets/portfolio', icon: FolderOpen },
      { label: 'Acquisition Analyzer', href: '/app/assets/acquisitions', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { label: 'Marketplace Dashboard', href: '/buyer', icon: LayoutDashboard, exact: true },
      { label: 'Browse Digital Assets', href: '/buyer/browse', icon: Search },
      { label: 'Sell a Digital Asset', href: '/seller/listings/new', icon: PackagePlus },
      { label: 'My Listings', href: '/seller/listings', icon: Tags, exact: true },
      { label: 'My Inquiries', href: '/buyer/inquiries', icon: MessageSquare },
      { label: 'My Purchases', href: '/buyer/purchases', icon: ShoppingBag },
      { label: 'Transactions', href: '/buyer/transactions', icon: ArrowRightLeft },
    ],
  },
  {
    title: 'Finances',
    sellerOnly: true,
    items: [
      { label: 'Financial Overview', href: '/seller/payouts', icon: Wallet, exact: true },
      { label: 'Payouts', href: '/seller/payouts/history', icon: Banknote },
      { label: 'Tax & Statements', href: '/seller/payouts/statements', icon: FileText },
    ],
  },
];

const MOBILE = '(max-width: 1080px)';
const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * "Go to Marketplace" launcher, rendered once by the shared app shell. Desktop:
 * a floating popover anchored to the launcher. Mobile: a full-width sheet.
 * Closes on Escape, outside click, route selection or the Close button, and
 * returns focus to the launcher.
 */
export function MarketplaceLauncher({ seller = false }: { seller?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => button.current?.focus());
  }, []);

  // Route selection closes the menu (focus moves to the new page instead).
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Anchor the desktop popover beside the launcher, kept inside the viewport.
  const place = useCallback(() => {
    const b = button.current?.getBoundingClientRect();
    const h = panel.current?.offsetHeight ?? 0;
    if (!b) return;
    const top = Math.max(12, Math.min(b.top - 8, window.innerHeight - h - 12));
    setPos({ left: b.right + 12, top });
  }, []);
  useLayoutEffect(() => {
    if (!open || mobile) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, mobile, place]);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      // Keep keyboard focus inside the menu while it is open.
      const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || button.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    if (mobile) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.body.style.overflow = '';
    };
  }, [open, mobile, close]);

  const isActive = (href: string, exact?: boolean) => pathname === href || (!exact && pathname.startsWith(`${href}/`));
  const groups = MARKETPLACE_GROUPS.filter((g) => !g.sellerOnly || seller);

  const menu = open
    ? createPortal(
        <>
          {mobile && <div className={s.backdrop} aria-hidden />}
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-modal={mobile || undefined}
            aria-labelledby={titleId}
            className={mobile ? s.sheet : s.popover}
            style={!mobile ? { left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' } : undefined}
          >
            <div className={s.head}>
              <span className={s.headIcon} aria-hidden>
                <Store size={22} />
              </span>
              <div className={s.headText}>
                <h2 id={titleId}>Explore AmpliVerify</h2>
                <p>Manage, value, buy and sell websites and other digital assets.</p>
              </div>
              <button type="button" className={s.close} onClick={() => close()} aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <div className={s.groups}>
              {groups.map((g) => (
                <nav key={g.title} className={s.group} aria-label={g.title}>
                  <h3>{g.title}</h3>
                  <ul>
                    {g.items.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className={`${s.item} ${isActive(item.href, item.exact) ? s.itemActive : ''}`} aria-current={isActive(item.href, item.exact) ? 'page' : undefined} onClick={() => close(false)}>
                          <item.icon size={18} aria-hidden />
                          <span>{item.label}</span>
                          <ChevronRight size={16} className={s.itemArrow} aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
            <Link href="/buyer" className={s.primary} onClick={() => close(false)}>
              Open Marketplace <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <div className={s.wrap}>
      <button
        ref={button}
        type="button"
        className={`${s.launcher} ${open ? s.launcherOpen : ''} ${pathname.startsWith('/app/assets') ? s.launcherCurrent : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Store size={22} aria-hidden />
        <span>Go to Marketplace</span>
        <ChevronRight size={18} className={s.launcherArrow} aria-hidden />
      </button>
      {menu}
    </div>
  );
}
