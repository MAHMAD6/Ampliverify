import { Download, Receipt } from 'lucide-react';
import { AdminHeader, ListPanel, MetricRow, StatusPanel } from '@/components/admin/AdminParts';
import { Button, Grid } from '@/components/ui';

export const metadata = { title: 'Billing & Invoices' };

export default function AdminBillingPage() {
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        title="Billing & Invoices"
        description="Review invoices, payments, and reconciliation status from authoritative billing records."
        actions={
          <Button variant="secondary" icon={<Download size={16} />} disabled>
            Export
          </Button>
        }
      />
      <MetricRow
        items={[
          { label: 'Invoices', note: 'No invoice data loaded' },
          { label: 'Paid', note: 'No paid invoices' },
          { label: 'Open', note: 'No open invoices' },
          { label: 'Failed / Void', note: 'No failed or void invoices' },
        ]}
      />
      <ListPanel
        title="Billing & Invoices"
        description="Billing documents and payment state from provider-confirmed records."
        search="Search invoice ID, organization, or email..."
        selects={['All statuses', 'Date range']}
        columns={['Invoice', 'Organization', 'Status', 'Total', 'Issued', 'Actions']}
        emptyIcon={<Receipt size={26} />}
        emptyTitle="No invoices available"
        emptyText="Invoices will appear when billing activity is available. Amounts, tax, and statuses come directly from the billing provider."
      />
      <Grid cols={2} style={{ marginTop: 16 }}>
        <StatusPanel
          title="Invoice Actions"
          description="Available actions depend on provider state and administrator permissions."
          rows={[
            ['View invoice', 'Provider-backed document'],
            ['Download PDF', 'When the provider supplies one'],
            ['Retry payment', 'Depends on provider state'],
            ['Void / refund', 'Confirmation required'],
          ]}
        />
        <StatusPanel
          title="Reconciliation"
          description="Billing inconsistencies between provider and AmpliVerify records."
          rows={[
            ['Unmatched payments', '—'],
            ['Webhook discrepancies', '—'],
            ['Refund mismatches', '—'],
            ['Tax issues', '—'],
          ]}
        />
      </Grid>
    </>
  );
}
