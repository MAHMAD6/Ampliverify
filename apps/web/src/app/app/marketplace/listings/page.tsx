import Link from 'next/link';
import { Tags } from 'lucide-react';
import { Badge, ButtonLink, DataTable, PageHeader, Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { assetLabel, LISTING_STATUS, money, type OwnListing } from '@/lib/marketplace';

export const metadata = { title: 'My Listings · Marketplace' };

export default async function MyListingsPage() {
  const res = await apiGet<OwnListing[]>('/user/marketplace/my/listings', { auth: true });
  const rows = res.ok ? res.data : [];
  return (
    <>
      <PageHeader title="My Listings" description="Assets you have listed. New and edited listings are reviewed before they go live." actions={<ButtonLink href="/app/marketplace/sell">Sell a Digital Asset</ButtonLink>} />
      <Panel bodyless>
        <DataTable
          columns={['Listing', 'Type', 'Price', 'Status', 'Inquiries', 'Created', 'Actions']}
          rows={rows.map((l) => {
            const st = LISTING_STATUS[l.status];
            return [
              <span key="t" style={{ display: 'grid', gap: 2 }}>
                <Link href={`/app/marketplace/browse/${l.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                  {l.title}
                </Link>
                {l.status === 'REJECTED' && l.reviewNote && <small style={{ color: 'var(--amber)' }}>Review note: {l.reviewNote}</small>}
              </span>,
              assetLabel(l.assetType),
              money(l.askingPriceMinor, l.currency),
              <Badge key="s" tone={st.tone}>
                {st.label}
              </Badge>,
              String(l.inquiries ?? 0),
              formatDate(l.createdAt),
              l.status === 'PUBLISHED' || l.status === 'PENDING_REVIEW' || l.status === 'REJECTED' ? (
                <ActionButton key="w" size="sm" variant="ghost" method="PATCH" path={`/user/marketplace/my/listings/${l.id}`} body={{ withdraw: true }} confirm={`Withdraw “${l.title}”? Buyers will no longer see it.`} successMessage="Listing withdrawn.">
                  Withdraw
                </ActionButton>
              ) : (
                '—'
              ),
            ];
          })}
          empty={<StateView kind="empty" icon={<Tags size={36} />} title={res.ok ? 'No listings yet' : 'Listings could not be loaded'} description={res.ok ? 'List a website or other digital asset to reach buyers.' : 'Please try again shortly.'} action={res.ok ? <ButtonLink href="/app/marketplace/sell">Sell a Digital Asset</ButtonLink> : undefined} />}
        />
      </Panel>
    </>
  );
}
