import { CreditCard, RefreshCw } from 'lucide-react';
import { AdminHeader, ListPanel, MetricRow, StatusPanel } from '@/components/admin/AdminParts';
import { Button, Grid } from '@/components/ui';

export const metadata = { title: 'Subscriptions' };

export default function SubscriptionsPage() {
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        title="Subscriptions"
        description="Monitor customer subscription lifecycle from billing provider and account records."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} disabled>
            Refresh Provider Data
          </Button>
        }
      />
      <MetricRow
        items={[
          { label: 'Total Subscriptions', note: 'No subscription data loaded' },
          { label: 'Active', note: 'No active subscriptions' },
          { label: 'Past Due', note: 'No past-due subscriptions' },
          { label: 'Canceled', note: 'No canceled subscriptions' },
        ]}
      />
      <ListPanel
        title="Subscriptions"
        description="Subscription state from the billing provider and internal account records."
        search="Search by organization, email, or subscription ID..."
        selects={['All statuses', 'All plans', 'All intervals']}
        columns={['Organization', 'Plan', 'Status', 'Interval', 'Period end', 'Actions']}
        emptyIcon={<CreditCard size={26} />}
        emptyTitle="No subscriptions yet"
        emptyText="Subscription records will appear here after billing activity exists."
      />
      <Grid cols={2} style={{ marginTop: 16 }}>
        <StatusPanel
          title="Subscription Controls"
          description="Consequential actions are limited and audited."
          rows={[
            ['Change plan', 'Requires confirmation'],
            ['Cancel subscription', 'Requires confirmation'],
            ['Resume subscription', 'Depends on provider state'],
            ['Refund handling', 'Follows the approved billing policy'],
          ]}
        />
        <StatusPanel
          title="Provider Sync"
          description="The billing provider is the source of truth for payment state."
          rows={[
            ['Last synchronization', 'Not available yet'],
            ['Webhook health', 'Not available yet'],
            ['Pending events', '—'],
            ['Reconciliation issues', '—'],
          ]}
        />
      </Grid>
    </>
  );
}
