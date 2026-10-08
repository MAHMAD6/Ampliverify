import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { ButtonLink, DataTable, KeyValue, Panel } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, INVOICE_TONE } from '@/lib/admin-data';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

export const metadata = { title: 'Invoice Detail' };

type Detail = {
  id: string;
  providerInvoiceId: string;
  status: keyof typeof INVOICE_TONE;
  currency: string;
  totalMinor: string;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: { id: string; description: string; amountMinor: string; quantity: string | null }[];
  workspace: { id: string; name: string; organization: { name: string } };
  subscription: { id: string; plan: { code: string; name: string } } | null;
  events: { id: string; providerEventId: string; eventType: string; receivedAt: string }[];
};

/**
 * Invoice Detail (admin-final-batch3/02). Amounts and lines are exactly what
 * Stripe reported; refunds, voids and payment retries are performed in Stripe
 * and arrive here through webhooks.
 */
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await adminGet<Detail>(`/admin/invoices/${encodeURIComponent(id)}`);
  if (!inv) notFound();
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        parent={{ label: 'Billing & Invoices', href: '/admin/billing' }}
        page={inv.providerInvoiceId}
        title="Invoice Detail"
        description="Inspect a provider-backed invoice."
        actions={
          <ButtonLink href={`https://dashboard.stripe.com/invoices/${encodeURIComponent(inv.providerInvoiceId)}`} variant="outline" icon={<ExternalLink size={16} />}>
            Open in Stripe
          </ButtonLink>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Panel title="Invoice Summary" flushHead>
          <KeyValue label="Invoice" value={<code>{inv.providerInvoiceId}</code>} />
          <KeyValue label="Status" value={<StatusPill tone={INVOICE_TONE[inv.status]}>{inv.status.toLowerCase()}</StatusPill>} />
          <KeyValue label="Account" value={`${inv.workspace.name} · ${inv.workspace.organization.name}`} />
          <KeyValue
            label="Subscription"
            value={
              inv.subscription ? (
                <Link href={`/admin/subscriptions/${inv.subscription.id}`} style={{ color: 'var(--blue)' }}>
                  {inv.subscription.plan.name}
                </Link>
              ) : (
                'One-time payment'
              )
            }
          />
          <KeyValue label="Invoice date" value={formatDate(inv.issuedAt ?? inv.createdAt)} />
          <KeyValue label="Total" value={<b>{formatMoney(inv.totalMinor, inv.currency)}</b>} />
        </Panel>
        <Panel title="Payment Events" description="Webhook events received for this invoice." bodyless>
          <DataTable
            columns={['Event', 'Stripe event', 'Received']}
            rows={inv.events.map((e) => [e.eventType, <code key="c">{e.providerEventId}</code>, formatDateTime(e.receivedAt)])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>No events recorded.</p>}
          />
        </Panel>
      </div>
      <div style={{ marginTop: 16 }}>
        <Panel title="Line Items" description="As reported by the billing provider." bodyless>
          <DataTable
            columns={['Description', 'Quantity', 'Amount']}
            rows={inv.lines.map((l) => [l.description, l.quantity ? Number(l.quantity).toLocaleString('en-US') : '—', formatMoney(l.amountMinor, inv.currency)])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>No line items reported.</p>}
          />
        </Panel>
      </div>
    </>
  );
}
