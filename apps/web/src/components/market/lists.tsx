import Link from 'next/link';
import { Handshake, MessageSquare } from 'lucide-react';
import { ButtonLink, DataTable, Panel } from '../ui';
import { formatDateTime } from '@/lib/format';
import { DEAL_STATUS, type InquiryRow, INTRO_STATUS, INQUIRY_STATUS, kindLabel, money, type Offer, OFFER_STATUS, ORDER_STATUS, type TransactionRow } from '@/lib/marketplace';
import { Empty, LoadError, StatusBadge } from './parts';

export function InquiryList({ rows, base, received }: { rows: InquiryRow[] | null; base: '/buyer' | '/seller'; received: boolean }) {
  if (!rows) return <LoadError what="Inquiries" />;
  if (!rows.length)
    return (
      <Empty
        icon={<MessageSquare size={40} />}
        title={received ? 'No inquiries yet' : 'No inquiries yet'}
        description={received ? 'Introduction requests and questions from buyers appear here once your listings are live.' : 'Request an introduction or ask a seller a question from any listing.'}
        action={received ? <ButtonLink href="/seller/listings">My Listings</ButtonLink> : <ButtonLink href="/buyer/browse">Browse Digital Assets</ButtonLink>}
      />
    );
  return (
    <Panel bodyless>
      <DataTable
        columns={['Listing', received ? 'From' : 'Type', 'Introduction', 'Status', 'Messages', 'Updated']}
        rows={rows.map((r) => [
          <Link key="l" href={`${base}/inquiries/${r.id}`}>
            {r.listing.title}
          </Link>,
          received ? r.from : kindLabel(r.listing.kind),
          <StatusBadge key="i" map={INTRO_STATUS} value={r.introStatus} />,
          <StatusBadge key="s" map={INQUIRY_STATUS} value={r.status} />,
          r.messages,
          formatDateTime(r.updatedAt),
        ])}
      />
    </Panel>
  );
}

export function OfferList({ rows, base }: { rows: Offer[] | null; base: '/buyer' | '/seller' }) {
  if (!rows) return <LoadError what="Offers" />;
  if (!rows.length)
    return (
      <Empty
        icon={<Handshake size={40} />}
        title="No offers yet"
        description={base === '/buyer' ? 'Once a seller accepts your introduction you can make an offer. Each counteroffer is kept as a separate version.' : 'Offers from buyers on your business listings appear here.'}
      />
    );
  return (
    <Panel bodyless>
      <DataTable
        columns={['Listing', 'Amount', 'Version', 'Status', 'Your move', 'Updated']}
        rows={rows.map((o) => [
          <Link key="l" href={`${base}/offers/${o.id}`}>
            {o.listing.title}
          </Link>,
          money(o.amountMinor, o.currency),
          o.version,
          <StatusBadge key="s" map={OFFER_STATUS} value={o.status} />,
          o.awaitingMe ? 'Respond' : '—',
          formatDateTime(o.updatedAt),
        ])}
      />
    </Panel>
  );
}

export function TransactionList({ rows, base }: { rows: TransactionRow[] | null; base: '/buyer' | '/seller' }) {
  if (!rows) return <LoadError what="Transactions" />;
  if (!rows.length) return <Empty icon={<Handshake size={40} />} title="No transactions yet" description="Purchases, sales and acquisition deals appear here with their payment and transfer status." />;
  return (
    <Panel bodyless>
      <DataTable
        columns={['Listing', 'Type', 'Role', 'Amount', 'Status', 'Date']}
        rows={rows.map((t) => [
          <Link key="l" href={t.kind === 'DIGITAL_PRODUCT' ? (t.role === 'BUYER' ? `/buyer/purchases/${t.id}` : `/seller/transactions`) : `${base}/transactions/${t.id}`}>
            {t.listing.title}
          </Link>,
          t.kind === 'DIGITAL_PRODUCT' ? 'Digital product' : 'Acquisition',
          t.role === 'BUYER' ? 'Buyer' : 'Seller',
          money(t.amountMinor, t.currency),
          <StatusBadge key="s" map={t.kind === 'DIGITAL_PRODUCT' ? ORDER_STATUS : DEAL_STATUS} value={t.status} />,
          formatDateTime(t.createdAt),
        ])}
      />
    </Panel>
  );
}
