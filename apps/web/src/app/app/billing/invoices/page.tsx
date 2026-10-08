import { CreditCard, Receipt } from 'lucide-react';
import { Badge, DataTable, KeyValue, PageHeader, Panel } from '@/components/ui';
import { RedirectButton } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { BillingTabs } from '@/components/app/billing/BillingTabs';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import type { BillingOverview, Invoice } from '@/lib/app-types';
import { formatDate, formatMoney, humanize } from '@/lib/format';

export const metadata = { title: 'Invoices · Billing & Plan' };

/** Invoices (from verified Stripe webhooks) and the provider-managed payment method. */
export default async function InvoicesPage() {
  const { workspaceId, me } = await getAppContext();
  const [invRes, billRes] = workspaceId
    ? await Promise.all([apiGet<Invoice[]>(`/user/workspaces/${workspaceId}/invoices`, { auth: true }), apiGet<BillingOverview>(`/user/workspaces/${workspaceId}/billing`, { auth: true })])
    : [null, null];
  const invoices = invRes?.ok ? invRes.data : [];
  const billing = billRes?.ok ? billRes.data : null;
  return (
    <>
      <PageHeader title="Invoices" description="View your invoices and billing history." crumbs={appCrumbs({ label: 'Billing & Plan', href: '/app/billing' }, { label: 'Invoices' })} />
      <BillingTabs active="invoices" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Invoice History" bodyless>
          <DataTable
            columns={['Invoice', 'Date', 'Items', 'Amount', 'Status']}
            rows={invoices.map((inv) => [
              <code key="i" style={{ fontSize: 12 }}>
                {inv.providerInvoiceId}
              </code>,
              formatDate(inv.issuedAt ?? inv.createdAt),
              inv.lines.map((l) => l.description).join(', ') || '—',
              formatMoney(inv.totalMinor, inv.currency),
              <Badge key="s" tone={inv.status === 'PAID' ? 'green' : 'amber'}>
                {humanize(inv.status)}
              </Badge>,
            ])}
            empty={<StateView kind="empty" compact icon={<Receipt size={28} />} title="No invoices yet" description="Invoices will appear here after billable activity exists." />}
          />
        </Panel>
        <Panel title="Payment Method" description="Managed securely by our payment provider.">
          <KeyValue label="Billing email" value={me?.email} />
          <KeyValue label="Plan" value={billing?.plan.name ?? 'No plan'} />
          <div style={{ marginTop: 16 }}>
            {billing?.subscription && workspaceId ? (
              <RedirectButton variant="secondary" icon={<CreditCard size={16} />} path={`/user/workspaces/${workspaceId}/billing/portal`}>
                Manage Payment Method & Download Invoices
              </RedirectButton>
            ) : (
              <small style={{ color: 'var(--muted)' }}>Your payment method is added during checkout.</small>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
