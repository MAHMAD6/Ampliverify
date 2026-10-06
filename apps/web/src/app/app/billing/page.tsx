import { Receipt } from 'lucide-react';
import { Button, ButtonLink, EmptyState, Grid, KeyValue, Metric, Notice, PageHeader, Panel } from '@/components/ui';

export const metadata = { title: 'Billing & Plan' };

/**
 * Plan, subscription, payment, invoice and credit data come from the billing
 * provider via the API. Those endpoints are not built yet, so every value
 * reads "Not available" and provider actions are disabled.
 */
export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing & Plan" description="Manage your subscription, payment details, invoices, and eligible credit purchases." crumbs={[{ label: 'Billing & Plan' }]} />
      <Grid cols={4} style={{ marginBottom: 18 }}>
        <Metric label="Current Plan" note="No plan data loaded" />
        <Metric label="Subscription Status" note="No subscription data loaded" />
        <Metric label="Billing Interval" note="Not available yet" />
        <Metric label="Available Credits" note="From your usage ledger" />
      </Grid>
      <Grid cols={2}>
        <Panel title="Plan & Subscription" description="Manage the current subscription and plan selection." flushHead>
          <KeyValue label="Plan" />
          <KeyValue label="Status" />
          <KeyValue label="Renewal / period end" />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <ButtonLink href="/pricing">View Plans</ButtonLink>
            <Button variant="secondary" disabled>
              Manage Subscription
            </Button>
          </div>
        </Panel>
        <Panel title="Payment Method" description="Payment details are managed securely by our payment provider." flushHead>
          <KeyValue label="Default payment method" />
          <KeyValue label="Billing email" />
          <Button variant="secondary" disabled style={{ marginTop: 16 }}>
            Manage Payment Method
          </Button>
        </Panel>
        <Panel title="Invoices" description="Recent billing documents." flushHead>
          <EmptyState compact icon={<Receipt size={22} />} title="No invoices available" description="Invoices will appear after billable activity exists." />
        </Panel>
        <Panel title="Buy Credits" description="Optional add-on credits, when enabled for your plan." flushHead>
          <KeyValue label="Credit purchases" value="Not available on your plan" />
          <Button variant="secondary" disabled style={{ marginTop: 16 }}>
            View Credit Options
          </Button>
        </Panel>
      </Grid>
      <div style={{ marginTop: 16 }}>
        <Notice tone="neutral">Amounts, invoices and payment details are shown exactly as recorded by our payment provider.</Notice>
      </div>
    </>
  );
}
