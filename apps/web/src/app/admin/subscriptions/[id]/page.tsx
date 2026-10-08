import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { ButtonLink, DataTable, KeyValue, Notice, Panel } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, SUB_TONE } from '@/lib/admin-data';
import { formatDate, formatMoney } from '@/lib/format';

export const metadata = { title: 'Subscription Detail' };

type Detail = {
  id: string;
  status: keyof typeof SUB_TONE;
  providerSubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: { code: string; name: string };
  workspace: { id: string; name: string; organization: { name: string; billingCustomerId?: string | null } };
  items: { quantity: number; planPrice: { billingInterval: string; amountMinor: string; currency: string; providerPriceId: string | null } }[];
  invoices: { id: string; providerInvoiceId: string; status: string; totalMinor: string; currency: string; issuedAt: string | null }[];
};

/**
 * Subscription Detail (admin-final-batch3/01). State is synchronized from
 * Stripe by webhooks; lifecycle changes (plan change, cancel, resume) are made
 * by the customer in the billing portal or by staff in Stripe, never edited
 * here, so this record stays authoritative.
 */
export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await adminGet<Detail>(`/admin/subscriptions/${encodeURIComponent(id)}`);
  if (!s) notFound();
  const price = s.items[0]?.planPrice;
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        parent={{ label: 'Subscriptions', href: '/admin/subscriptions' }}
        page={s.workspace.name}
        title="Subscription Detail"
        description="Review a subscription synchronized from the billing provider."
        actions={
          s.providerSubscriptionId ? (
            <ButtonLink href={`https://dashboard.stripe.com/subscriptions/${encodeURIComponent(s.providerSubscriptionId)}`} variant="outline" icon={<ExternalLink size={16} />}>
              Open in Stripe
            </ButtonLink>
          ) : undefined
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="neutral" title="Subscription state:">
          Status, renewal and cancellation come from Stripe webhooks. Plan changes and cancellations are made in Stripe or by the customer in the billing portal, and sync back here.
        </Notice>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Panel title="Subscription Summary" flushHead>
          <KeyValue label="Subscription ID" value={<code>{s.id}</code>} />
          <KeyValue
            label="Workspace"
            value={
              <Link href={`/admin/search?q=${encodeURIComponent(s.workspace.name)}`} style={{ color: 'var(--blue)' }}>
                {s.workspace.name} · {s.workspace.organization.name}
              </Link>
            }
          />
          <KeyValue label="Plan" value={<Link href={`/admin/plans/${encodeURIComponent(s.plan.code)}`} style={{ color: 'var(--blue)' }}>{s.plan.name}</Link>} />
          <KeyValue label="Status" value={<StatusPill tone={SUB_TONE[s.status]}>{s.status.replace('_', ' ').toLowerCase()}</StatusPill>} />
          <KeyValue label="Price" value={price ? `${formatMoney(price.amountMinor, price.currency)} / ${price.billingInterval === 'MONTHLY' ? 'month' : 'year'}` : '—'} />
          <KeyValue label="Current period" value={`${formatDate(s.currentPeriodStart)} – ${formatDate(s.currentPeriodEnd)}`} />
          <KeyValue label="Cancellation" value={s.canceledAt ? `Canceled ${formatDate(s.canceledAt)}` : s.cancelAtPeriodEnd ? `Cancels on ${formatDate(s.currentPeriodEnd)}` : 'Renews automatically'} />
        </Panel>
        <Panel title="Billing Provider" flushHead>
          <KeyValue label="Stripe subscription" value={s.providerSubscriptionId ? <code>{s.providerSubscriptionId}</code> : 'Not linked'} />
          <KeyValue label="Stripe price" value={price?.providerPriceId ? <code>{price.providerPriceId}</code> : 'Not synced'} />
          <KeyValue label="Created" value={formatDate(s.createdAt)} />
          <KeyValue label="Last sync" value={formatDate(s.updatedAt)} />
        </Panel>
      </div>
      <div style={{ marginTop: 16 }}>
        <Panel title="Invoices" description="Invoices for this subscription, newest first." bodyless>
          <DataTable
            columns={['Invoice', 'Status', 'Total', 'Issued', '']}
            rows={s.invoices.map((i) => [
              <code key="i">{i.providerInvoiceId}</code>,
              i.status.toLowerCase(),
              formatMoney(i.totalMinor, i.currency),
              i.issuedAt ? formatDate(i.issuedAt) : '—',
              <Link key="v" href={`/admin/billing/invoices/${i.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                View
              </Link>,
            ])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>No invoices yet.</p>}
          />
        </Panel>
      </div>
    </>
  );
}
