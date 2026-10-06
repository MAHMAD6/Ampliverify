import { ProviderDetail } from '@/components/admin/ProviderDetail';

export const metadata = { title: 'Subscription Detail' };

/** Subscription Detail (admin-final-batch3/01). The subscriptions admin API is not built; see ProviderDetail. */
export default function SubscriptionDetailPage() {
  return (
    <ProviderDetail
      section="Billing & Access"
      parent={{ label: 'Subscriptions', href: '/admin/subscriptions' }}
      title="Subscription Detail"
      description="Review a subscription and perform controlled lifecycle actions."
      integrity={
        <>
          <b>Subscription state:</b> status, renewal, cancellation, payment, and provider identifiers come from the billing provider and synchronized backend records. This subscription could not be loaded.
        </>
      }
      headerAction="Refresh Provider Data"
      summary={{ title: 'Subscription Summary', description: 'Authoritative subscription details.', rows: ['Subscription ID', 'Organization / account', 'Plan', 'Status', 'Billing interval', 'Current period'] }}
      provider={{ title: 'Billing Provider', description: 'Provider-backed identifiers and payment state.', rows: ['Customer ID', 'Provider price ID', 'Default payment method', 'Latest invoice', 'Last sync'] }}
      actions={{
        title: 'Lifecycle Controls',
        description: 'Actions depend on current provider state.',
        items: [
          { label: 'Change plan', text: 'Review proration and entitlement consequences before confirmation.', cta: 'Review' },
          { label: 'Cancel subscription', text: 'Choose immediate or period-end cancellation where supported.', cta: 'Review' },
          { label: 'Resume subscription', text: 'Available only when provider state allows resumption.', cta: 'Review' },
        ],
      }}
      timeline={{ title: 'Subscription Timeline', description: 'Provider and system events, chronologically.', empty: 'No subscription events yet' }}
    />
  );
}
