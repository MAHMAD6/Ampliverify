import { Pills } from '@/components/market/parts';

const TABS = [
  { key: 'overview', label: 'Overview', href: '/admin/marketplace' },
  { key: 'listings', label: 'Listing Review', href: '/admin/marketplace/listings' },
  { key: 'sellers', label: 'Sellers', href: '/admin/marketplace/sellers' },
  { key: 'verification', label: 'Seller Verification', href: '/admin/marketplace/verification' },
  { key: 'transactions', label: 'Transactions & Disputes', href: '/admin/marketplace/transactions' },
  { key: 'payouts', label: 'Commissions & Payouts', href: '/admin/marketplace/payouts' },
  { key: 'settings', label: 'Settings', href: '/admin/marketplace/settings' },
];

export function AdminMarketNav({ active }: { active: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Pills items={TABS} active={active} label="Marketplace administration" />
    </div>
  );
}
