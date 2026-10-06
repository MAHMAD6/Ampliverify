import { ReceiptText } from 'lucide-react';
import { ProviderDetail } from '@/components/admin/ProviderDetail';

export const metadata = { title: 'Invoice Detail' };

/** Invoice Detail (admin-final-batch3/02). Amounts, lines and documents are provider-backed (`invoices`, `invoice_lines`). */
export default function InvoiceDetailPage() {
  return (
    <ProviderDetail
      section="Billing & Access"
      parent={{ label: 'Billing & Invoices', href: '/admin/billing' }}
      title="Invoice Detail"
      description="Inspect a provider-backed invoice and perform permitted billing actions."
      integrity={
        <>
          <b>Invoice integrity:</b> amounts, tax, currency, payment method details, status, and documents come from the billing provider. This invoice could not be loaded.
        </>
      }
      headerAction="Open Provider Record"
      summary={{ title: 'Invoice Summary', description: 'Provider-confirmed billing document details.', rows: ['Invoice ID', 'Status', 'Account', 'Subscription', 'Invoice date', 'Due date'] }}
      provider={{ title: 'Financial Summary', description: 'Only provider-confirmed values.', rows: ['Subtotal', 'Tax', 'Credits / adjustments', 'Total', 'Amount paid', 'Amount due'] }}
      middle={{ title: 'Line Items', description: 'Provider-supplied invoice lines.', emptyTitle: 'No invoice line items available', emptyText: 'Line descriptions, quantities, unit amounts, discounts, taxes, and totals populate from the billing provider.', icon: <ReceiptText size={26} /> }}
      actions={{
        title: 'Invoice Actions',
        description: 'Available actions depend on invoice state and permissions.',
        items: [
          { label: 'Download invoice', text: 'Uses the provider-generated PDF when available.', cta: 'Download' },
          { label: 'Retry payment', text: 'Only when supported for the current invoice state.', cta: 'Review' },
          { label: 'Void or refund', text: 'Consequential; requires confirmation and is audited.', cta: 'Review' },
        ],
      }}
      timeline={{ title: 'Invoice Timeline', description: 'Payment and invoice events from the provider.', empty: 'No invoice events yet' }}
    />
  );
}
