'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, LayoutGrid, Store } from 'lucide-react';
import m from './market.module.css';

/** Start Selling (not onboarded) or Switch view (authorized sellers), plus the way back to the AmpliVerify tools. */
export function MarketFooter({ seller }: { seller: boolean }) {
  const pathname = usePathname();
  const inSeller = pathname === '/seller' || pathname.startsWith('/seller/');
  return (
    <div className={m.sideFooter}>
      {seller ? (
        <Link href={inSeller ? '/buyer' : '/seller'} className={m.sideCta}>
          <ArrowLeftRight size={20} aria-hidden />
          <span>
            <b>{inSeller ? 'Switch to Buyer View' : 'Switch to Seller View'}</b>
            <small>{inSeller ? 'Browse and buy digital assets' : 'Manage listings and earnings'}</small>
          </span>
        </Link>
      ) : (
        <Link href="/seller" className={m.sideCta}>
          <Store size={20} aria-hidden />
          <span>
            <b>Start Selling</b>
            <small>List and sell your digital assets</small>
          </span>
        </Link>
      )}
      <Link href="/app/dashboard" className={m.sideTools}>
        <LayoutGrid size={18} aria-hidden />
        Go to AmpliVerify Tools
      </Link>
    </div>
  );
}
