import { CalendarDays } from 'lucide-react';
import { PageHeader, TabNav, type Crumb } from '@/components/ui';
import s from './usage.module.css';

/** Usage & Credits header with the billing period (from the subscription API; "—" until it exists) and sub-pages. */
export function UsageHeader({ active = 'overview', crumbs }: { active?: 'overview' | 'history'; crumbs?: Crumb[] }) {
  return (
    <>
      <PageHeader
        title={active === 'history' ? 'Credit History' : 'Usage & Credits'}
        description={active === 'history' ? 'Every credit grant, purchase, use and adjustment, newest first.' : 'Track your usage, manage credits, and understand how they are used across AmpliVerify.'}
        crumbs={crumbs}
        actions={
          <span className={s.period}>
            <CalendarDays size={18} /> Billing Period
            <span className={s.periodBox}>
              Current Period <span>— to —</span>
            </span>
          </span>
        }
      />
      <TabNav
        active={active}
        tabs={[
          { key: 'overview', label: 'Usage Overview', href: '/app/usage' },
          { key: 'history', label: 'Credit History', href: '/app/usage/history' },
        ]}
      />
    </>
  );
}
