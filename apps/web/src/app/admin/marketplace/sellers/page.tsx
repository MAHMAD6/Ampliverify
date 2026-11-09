import { Search, Users } from 'lucide-react';
import { Button, DataTable, Field, Input, PageHeader, Panel } from '@/components/ui';
import { NoteAction } from '@/components/market/forms';
import { StateView } from '@/components/ui/StateView';
import { AdminMarketNav } from '@/components/admin/market/AdminMarketNav';
import { StatusBadge } from '@/components/market/parts';
import { adminGet } from '@/lib/admin-data';
import { formatDate } from '@/lib/format';
import { CHECK_STATUS, SELLER_STATUS } from '@/lib/marketplace';

export const metadata = { title: 'Seller Management · Admin' };

type SellerRow = { id: string; userId: string; displayName: string; email: string; status: string; identity: string; business: string; payout: string; payoutsEnabled: boolean; liveListings: number; createdAt: string };

export default async function AdminSellers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.slice(0, 120) ?? '';
  const rows = await adminGet<SellerRow[]>(`/admin/marketplace/sellers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  return (
    <>
      <PageHeader title="Seller Management" description="Seller accounts, their checks and status. Suspending a seller withdraws their live listings." />
      <AdminMarketNav active="sellers" />
      <Panel>
        <form role="search" action="/admin/marketplace/sellers" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <Field label="Search sellers" htmlFor="sq">
              <Input id="sq" name="q" defaultValue={q} placeholder="Name or email" icon={<Search size={16} />} />
            </Field>
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Panel>
      <div style={{ marginTop: 16 }}>
        {!rows ? (
          <Panel>
            <StateView kind="error" title="Sellers could not be loaded with your permissions." />
          </Panel>
        ) : rows.length === 0 ? (
          <Panel>
            <StateView kind="empty" icon={<Users size={36} />} title={q ? 'No sellers match' : 'No sellers yet'} description="Sellers appear here once they create a seller profile." />
          </Panel>
        ) : (
          <Panel bodyless>
            <DataTable
              columns={['Seller', 'Status', 'Identity', 'Business', 'Payouts', 'Live listings', 'Since', 'Action']}
              rows={rows.map((s) => [
                <span key="n">
                  <b>{s.displayName}</b>
                  <br />
                  <small>{s.email}</small>
                </span>,
                <StatusBadge key="st" map={SELLER_STATUS} value={s.status} />,
                <StatusBadge key="i" map={CHECK_STATUS} value={s.identity} />,
                <StatusBadge key="b" map={CHECK_STATUS} value={s.business} />,
                s.payoutsEnabled ? 'Enabled' : 'Not ready',
                s.liveListings,
                formatDate(s.createdAt),
                s.status === 'SUSPENDED' ? (
                  <NoteAction key="a" path={`/admin/marketplace/sellers/${s.id}/status`} body={{ status: 'ACTIVE' }} label="Reactivate" placeholder="Reason" required successMessage="Seller reactivated." />
                ) : (
                  <NoteAction key="a" path={`/admin/marketplace/sellers/${s.id}/status`} body={{ status: 'SUSPENDED' }} label="Suspend" placeholder="Reason (kept in the audit log)" required variant="outline" confirm={`Suspend ${s.displayName}? Their live listings will be withdrawn.`} successMessage="Seller suspended." />
                ),
              ])}
            />
          </Panel>
        )}
      </div>
    </>
  );
}
