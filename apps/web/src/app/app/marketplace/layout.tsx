import { MarketNav } from '@/components/app/marketplace/MarketNav';

/** Marketplace section: its own pages and dashboard inside the signed-in app. */
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketNav />
      {children}
    </>
  );
}
