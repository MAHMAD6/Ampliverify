import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock3, FileSearch, FileText, XCircle } from 'lucide-react';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, INVOICE_TONE, matchesQ } from '@/lib/admin-data';
import { formatDate, formatMoney } from '@/lib/format';

export const metadata = { title: 'Billing & Invoices' };

type Invoice = { id: string; providerInvoiceId: string; status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE'; currency: string; totalMinor: string; issuedAt: string | null; createdAt: string; workspace: { id: string; name: string } };

const TABS: Record<string, string | null> = { all: null, paid: 'PAID', open: 'OPEN', uncollectible: 'UNCOLLECTIBLE', void: 'VOID', draft: 'DRAFT' };

/** Billing & Invoices (chat design 2026-10-06). Provider-backed `invoices`; detail at /admin/billing/invoices/[id]. */
export default async function BillingInvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'all', q } = await searchParams;
  const invoices = await adminGet<Invoice[]>('/admin/invoices');
  const list = invoices ?? [];
  const count = (s: string) => (invoices ? list.filter((i) => i.status === s).length : undefined);
  const rows = list.filter((i) => (!TABS[tab] || i.status === TABS[tab]) && matchesQ(q, i.providerInvoiceId, i.workspace.name));
  return (
    <AdminList
      section="Billing & Access"
      title="Billing & Invoices"
      description="View all billing invoices synchronized from the payment provider."
      metrics={[
        { label: 'Total Invoices', icon: <FileText size={24} />, tone: 'blue', value: invoices ? list.length : undefined },
        { label: 'Paid', icon: <CheckCircle2 size={24} />, tone: 'green', value: count('PAID') },
        { label: 'Open', icon: <Clock3 size={24} />, tone: 'amber', value: count('OPEN') },
        { label: 'Uncollectible', icon: <AlertCircle size={24} />, tone: 'red', value: count('UNCOLLECTIBLE') },
        { label: 'Voided', icon: <XCircle size={24} />, tone: 'purple', value: count('VOID') },
      ]}
      tabs={Object.keys(TABS).map((k) => ({ key: k, label: k === 'all' ? 'All Invoices' : k.charAt(0).toUpperCase() + k.slice(1) }))}
      activeTab={tab}
      basePath="/admin/billing"
      search="Search by invoice number or workspace..."
      liveFilters={{ q }}
      columns={['Invoice #', 'Workspace', 'Amount', 'Status', 'Invoice Date', 'Actions']}
      rows={rows.map((i) => [
        <code key="n">{i.providerInvoiceId}</code>,
        i.workspace.name,
        formatMoney(i.totalMinor, i.currency),
        <StatusPill key="s" tone={INVOICE_TONE[i.status]}>
          {i.status.charAt(0) + i.status.slice(1).toLowerCase()}
        </StatusPill>,
        formatDate(i.issuedAt ?? i.createdAt),
        <Link key="v" href={`/admin/billing/invoices/${i.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          View
        </Link>,
      ])}
      empty={{ icon: <FileSearch size={40} />, title: invoices ? 'No invoices yet' : 'Invoices unavailable', text: invoices ? 'When invoices are generated for subscriptions, they will appear here.' : 'Your account cannot read billing data, or the API is unavailable.' }}
    />
  );
}
