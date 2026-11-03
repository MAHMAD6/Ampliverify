import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Badge, ButtonLink, DataTable, Notice, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { formatDate, humanize } from '@/lib/format';
import { type MarketTransaction, money } from '@/lib/marketplace';

export const metadata = { title: 'My Purchases · Marketplace' };

export default async function Page() {
  const res = await apiGet<MarketTransaction[]>('/user/marketplace/my/purchases', { auth: true });
  const rows = res.ok ? res.data : [];
  return (
    <>
      <PageHeader title="My Purchases" description="Digital assets you have bought through the Marketplace." />
      <div style={{ marginBottom: 14 }}>
        <Notice tone="neutral">Marketplace payments and escrow are not live yet. Records appear here only once the verified payment provider confirms them.</Notice>
      </div>
      <Panel bodyless>
        <DataTable
          columns={['Asset', 'Amount', 'Status', 'Date']}
          rows={rows.map((t) => [
            <Link key="l" href={`/app/marketplace/browse/${t.listing.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
              {t.listing.title}
            </Link>,
            money(t.amountMinor, t.currency),
            <Badge key="s" tone={t.status === 'COMPLETED' ? 'green' : t.status === 'PENDING' || t.status === 'IN_ESCROW' ? 'amber' : undefined}>
              {humanize(t.status)}
            </Badge>,
            formatDate(t.completedAt ?? t.createdAt),
          ])}
          empty={<StateView kind={res.ok ? 'empty' : 'error'} icon={<ShoppingBag size={36} />} title={res.ok ? 'No purchases yet' : 'Records could not be loaded'} description={res.ok ? 'EMPTYDigital assets you have bought through the Marketplace.' : 'Please try again shortly.'} action={res.ok ? <ButtonLink href="/app/marketplace/browse" variant="outline">Browse Digital Assets</ButtonLink> : undefined} />}
        />
      </Panel>
    </>
  );
}
