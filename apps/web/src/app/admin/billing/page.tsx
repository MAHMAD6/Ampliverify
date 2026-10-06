import { AlertCircle, CheckCircle2, Clock3, FileSearch, FileText, RotateCcw, XCircle } from 'lucide-react';
import { AdminList } from '@/components/admin/AdminList';

export const metadata = { title: 'Billing & Invoices' };

/** Billing & Invoices (chat design 2026-10-06). Provider-backed `invoices`; detail at /admin/billing/invoices/[id]. */
export default async function BillingInvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'all' } = await searchParams;
  return (
    <AdminList
      section="Billing & Access"
      title="Billing & Invoices"
      description="View and manage all billing invoices."
      metrics={[
        { label: 'Total Invoices', icon: <FileText size={24} />, tone: 'blue' },
        { label: 'Paid', icon: <CheckCircle2 size={24} />, tone: 'green' },
        { label: 'Open', icon: <Clock3 size={24} />, tone: 'amber' },
        { label: 'Past Due', icon: <AlertCircle size={24} />, tone: 'red' },
        { label: 'Voided', icon: <XCircle size={24} />, tone: 'purple' },
        { label: 'Refunded', icon: <RotateCcw size={24} />, tone: 'slate' },
      ]}
      tabs={[
        { key: 'all', label: 'All Invoices' },
        { key: 'paid', label: 'Paid' },
        { key: 'open', label: 'Open' },
        { key: 'past-due', label: 'Past Due' },
        { key: 'voided', label: 'Voided' },
        { key: 'refunded', label: 'Refunded' },
      ]}
      activeTab={tab}
      basePath="/admin/billing"
      search="Search by invoice number, user, account, or email..."
      selects={[
        { label: 'Status', options: ['All Statuses'] },
        { label: 'Plan', options: ['All Plans'] },
        { label: 'Billing Period', options: ['Select date range'] },
      ]}
      columns={['Invoice #', 'Subscriber / Account', 'Plan', 'Amount', 'Status', 'Invoice Date', 'Due Date', 'Paid Date', 'Actions']}
      empty={{ icon: <FileSearch size={40} />, title: 'No invoices yet', text: 'When invoices are generated for subscriptions, they will appear here.' }}
    />
  );
}
