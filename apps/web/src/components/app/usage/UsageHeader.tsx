import { CalendarDays } from 'lucide-react';
import { PageHeader, TabNav, type Crumb } from '@/components/ui';
import { formatDate } from '@/lib/format';
import s from './usage.module.css';

/** Usage & Credits header with the current billing period and sub-pages. */
export function UsageHeader({ active = 'overview', crumbs, periodStart, periodEnd }: { active?: 'overview' | 'history'; crumbs?: Crumb[]; periodStart?: string | null; periodEnd?: string | null }) {
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
              Current Period <span>{periodStart ? `${formatDate(periodStart)} to ${periodEnd ? formatDate(periodEnd) : 'month end'}` : '— to —'}</span>
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
