import { PageHeader } from '@/components/ui';
import { TransactionList } from '@/components/market/lists';
import { apiGet } from '@/lib/api';
import type { TransactionRow } from '@/lib/marketplace';

export const metadata = { title: 'Transactions · Marketplace' };

export default async function BuyerTransactionsPage() {
  const res = await apiGet<TransactionRow[]>('/user/marketplace/my/transactions', { auth: true });
  return (
    <>
      <PageHeader title="Transactions" description="Your digital-product purchases and acquisition deals, with payment and transfer status. Report an issue or request a refund from the purchase or deal page." />
      <TransactionList rows={res.ok ? res.data.filter((t) => t.role === 'BUYER') : null} base="/buyer" />
    </>
  );
}
