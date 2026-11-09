import { PageHeader } from '@/components/ui';
import { PayoutTabs } from './tabs';

export default function PayoutsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Payouts & Earnings" description="Your marketplace balance, payouts and statements, from the seller ledger. Payouts start once your available balance reaches $50." />
      <PayoutTabs />
      <div style={{ marginTop: 16 }}>{children}</div>
    </>
  );
}
