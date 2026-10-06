import { CreditCard, Receipt } from 'lucide-react';
import { Button, DataTable, KeyValue, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { BillingTabs } from '@/components/app/billing/BillingTabs';
import { appCrumbs } from '@/lib/nav';

export const metadata = { title: 'Invoices · Billing & Plan' };

/**
 * Invoices and payment method (`invoices`, `invoice_lines`; provider-managed
 * payment details). The billing API is not built yet, so both are empty and
 * provider actions are disabled.
 */
export default function InvoicesPage() {
  return (
    <>
      <PageHeader title="Invoices" description="View and download your invoices and billing history." crumbs={appCrumbs({ label: 'Billing & Plan', href: '/app/billing' }, { label: 'Invoices' })} />
      <BillingTabs active="invoices" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Invoice History" bodyless>
          <DataTable
            columns={['Invoice', 'Date', 'Period', 'Amount', 'Status', 'Download']}
            empty={<StateView kind="empty" compact icon={<Receipt size={28} />} title="No invoices yet" description="Invoices will appear here after billable activity exists." />}
          />
        </Panel>
        <Panel title="Payment Method" description="Managed securely by our payment provider.">
          <KeyValue label="Default payment method" />
          <KeyValue label="Billing email" />
          <Button variant="secondary" disabled icon={<CreditCard size={16} />} style={{ marginTop: 16 }}>
            Manage Payment Method
          </Button>
        </Panel>
      </div>
    </>
  );
}
