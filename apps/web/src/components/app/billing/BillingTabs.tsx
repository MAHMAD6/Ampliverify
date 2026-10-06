import { TabNav } from '@/components/ui';

/** Billing & Plan sub-pages from the navigation page map. */
export function BillingTabs({ active }: { active: 'plans' | 'invoices' }) {
  return (
    <TabNav
      active={active}
      tabs={[
        { key: 'plans', label: 'Plans', href: '/app/billing' },
        { key: 'invoices', label: 'Invoices', href: '/app/billing/invoices' },
      ]}
    />
  );
}
