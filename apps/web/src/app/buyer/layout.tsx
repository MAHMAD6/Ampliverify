import type { Metadata } from 'next';
import { MarketShell } from '@/components/market/MarketShell';
import { apiGet } from '@/lib/api';
import { getAppContext } from '@/lib/project';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Buyer Dashboard area: no SEO subscription or credit gate (V2 guide §3). */
export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const { me } = await getAppContext();
  const unread = me ? await apiGet<{ count: number }>('/user/notifications/unread-count', { auth: true }) : null;
  return (
    <MarketShell me={me} unread={unread?.ok ? unread.data.count : 0}>
      {children}
    </MarketShell>
  );
}
