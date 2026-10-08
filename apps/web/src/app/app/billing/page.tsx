import Link from 'next/link';
import { ArrowLeftRight, Coins, FileText, ShieldCheck, Tags } from 'lucide-react';
import { PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { BillingTabs } from '@/components/app/billing/BillingTabs';
import { PlanCatalog, priceFor, type Interval } from '@/components/app/billing/PlanCatalog';
import { apiGet, apiList } from '@/lib/api';
import { getAppContext } from '@/lib/project';
import type { BillingOverview } from '@/lib/app-types';
import { Notice } from '@/components/ui';
import type { PublicPlan } from '@/lib/types';
import s from '@/components/app/billing/plans.module.css';

export const metadata = { title: 'Billing & Plan' };

/** Plans (`/billing` in the navigation page map; design user-settings/Billing_Plan_Plans.webp). */
export default async function BillingPlansPage({ searchParams }: { searchParams: Promise<{ interval?: string; checkout?: string }> }) {
  const sp = await searchParams;
  const plans = await apiList<PublicPlan>('/public/plans');
  const { workspaceId } = await getAppContext();
  const billing = workspaceId ? await apiGet<BillingOverview>(`/user/workspaces/${workspaceId}/billing`, { auth: true }) : null;
  const overview = billing?.ok ? billing.data : null;
  const interval: Interval = sp.interval === 'annual' && plans.some((p) => priceFor(p, 'ANNUAL')) ? 'ANNUAL' : 'MONTHLY';

  return (
    <>
      <PageHeader title="Billing & Plan" description="Choose the plan that fits your SEO goals. Upgrade, downgrade, or manage your subscription." />
      <BillingTabs active="plans" />
      {sp.checkout === 'canceled' && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="neutral" title="Checkout canceled">No changes were made to your plan.</Notice>
        </div>
      )}
      {plans.length === 0 ? (
        <Panel>
          <StateView kind="empty" icon={<Tags size={36} />} title="Plans are being finalized" description="Published plans and prices will appear here." />
        </Panel>
      ) : (
        <PlanCatalog plans={plans} interval={interval} basePath="/app/billing" currentCode={overview?.plan.code ?? null} workspaceId={workspaceId} paymentsEnabled={!!overview?.paymentsEnabled} />
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
            <small>Upgrade here; manage, downgrade or cancel from Settings → Billing & Plan.</small>
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
