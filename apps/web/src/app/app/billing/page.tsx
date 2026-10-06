import Link from 'next/link';
import { ArrowLeftRight, Coins, FileText, ShieldCheck, Tags } from 'lucide-react';
import { PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { BillingTabs } from '@/components/app/billing/BillingTabs';
import { PlanCatalog, priceFor, type Interval } from '@/components/app/billing/PlanCatalog';
import { apiList } from '@/lib/api';
import type { PublicPlan } from '@/lib/types';
import s from '@/components/app/billing/plans.module.css';

export const metadata = { title: 'Billing & Plan' };

/** Plans (`/billing` in the navigation page map; design user-settings/Billing_Plan_Plans.webp). */
export default async function BillingPlansPage({ searchParams }: { searchParams: Promise<{ interval?: string }> }) {
  const plans = await apiList<PublicPlan>('/public/plans');
  const interval: Interval = (await searchParams).interval === 'annual' && plans.some((p) => priceFor(p, 'ANNUAL')) ? 'ANNUAL' : 'MONTHLY';

  return (
    <>
      <PageHeader title="Billing & Plan" description="Choose the plan that fits your SEO goals. Upgrade, downgrade, or manage your subscription." />
      <BillingTabs active="plans" />
      {plans.length === 0 ? (
        <Panel>
          <StateView kind="empty" icon={<Tags size={36} />} title="Plans are being finalized" description="Published plans and prices will appear here." />
        </Panel>
      ) : (
        <PlanCatalog plans={plans} interval={interval} basePath="/app/billing" />
      )}
      <div className={s.facts}>
        <div className={s.fact}>
          <Coins size={22} />
          <span>
            <b>AI Credits</b>
            <small>Credits are used for AI analysis, content generation, GEO tracking and other premium features.</small>
          </span>
        </div>
        <div className={s.fact}>
          <ArrowLeftRight size={22} />
          <span>
            <b>Change Your Plan</b>
            <small>Upgrade or downgrade from this page once billing is enabled for your workspace.</small>
          </span>
        </div>
        <div className={s.fact}>
          <ShieldCheck size={22} />
          <span>
            <b>Secure Payments</b>
            <small>Payments are handled by our payment provider; card details are never stored by AmpliVerify.</small>
          </span>
        </div>
        <div className={s.fact}>
          <FileText size={22} />
          <span>
            <b>Invoices</b>
            <small>
              View and download your invoices in <Link href="/app/billing/invoices" style={{ color: 'var(--blue)' }}>Invoices</Link>.
            </small>
          </span>
        </div>
      </div>
    </>
  );
}
