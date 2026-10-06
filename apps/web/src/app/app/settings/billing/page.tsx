import Link from 'next/link';
import { BarChart3, BookOpen, Coins, Repeat, ShieldCheck, Crown, CreditCard, Database, ExternalLink, FileText, Info } from 'lucide-react';
import { AddCreditsButton } from '@/components/app/billing/AddCreditsDialog';
import { Button, ButtonLink, EmptyState, Grid, IconCircle } from '@/components/ui';
import { PlanCatalog, priceFor, type Interval } from '@/components/app/billing/PlanCatalog';
import { PlanCompare } from '@/components/app/billing/PlanCompare';
import { apiList } from '@/lib/api';
import type { PublicPlan } from '@/lib/types';
import b from '@/components/app/billing/billing.module.css';

export const metadata = { title: 'Billing & Plan · Settings' };

/**
 * Settings view of billing. Plan, subscription, wallet balance, credit packs,
 * payment method and invoices come from the billing API, which is not built
 * yet, so each area shows its empty state ("No active plan", "—").
 */
export default async function SettingsBillingPage({ searchParams }: { searchParams: Promise<{ interval?: string }> }) {
  const plans = await apiList<PublicPlan>('/public/plans');
  const interval: Interval = (await searchParams).interval === 'annual' && plans.some((p) => priceFor(p, 'ANNUAL')) ? 'ANNUAL' : 'MONTHLY';
  return (
    <>
      <h2>Billing &amp; Plan</h2>
      <p>View your current plan, manage billing, and access invoices.</p>
      <div style={{ display: 'grid', gap: 16 }}>
        <div className={b.planCard}>
          <IconCircle tone="blue" size={72}>
            <Crown size={32} />
          </IconCircle>
          <div>
            <h3>Current Plan</h3>
            <strong>No active plan</strong>
            <p>Your plan details will appear here once a subscription is active.</p>
          </div>
          <div className={b.planActions}>
            <ButtonLink href="/app/billing" size="lg">
              View Plans
            </ButtonLink>
            <Link href="/app/billing">Compare Plans</Link>
          </div>
        </div>

        <section className={b.section}>
          <div className={b.sectionHead}>
            <IconCircle tone="blue" size={64}>
              <Database size={28} />
            </IconCircle>
            <div style={{ flex: 1 }}>
              <h3>Credits &amp; Usage</h3>
              <p>Credits are used for AI-powered analysis, content generation, and other premium features.</p>
            </div>
            <ButtonLink href="/help?q=credits" variant="secondary" icon={<BookOpen size={16} />}>
              How credits work <ExternalLink size={14} />
            </ButtonLink>
          </div>
          <div className={b.tiles}>
            {[
              ['Current Balance', 'Credits available'],
              ['Included This Period', 'From your plan'],
              ['Used This Period', 'Credits used'],
              ['Next Renewal', 'Renews on —'],
            ].map(([label, note]) => (
              <div key={label} className={b.tile}>
                <span>
                  {label} <Info size={14} color="var(--muted)" />
                </span>
                <strong>—</strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <AddCreditsButton packs={[]} balance={null} />
            <ButtonLink href="/app/usage" variant="outline" size="lg" icon={<BarChart3 size={18} />}>
              View Usage &amp; History
            </ButtonLink>
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 20 }}>Plan Features</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>View the key features included in each plan and find the right plan for your needs.</p>
          {plans.length > 0 ? (
            <PlanCatalog plans={plans} interval={interval} basePath="/app/settings/billing" />
          ) : (
            <div className={b.boxed}>
              <EmptyState icon={<FileText size={26} />} title="Plans are being finalized" description="Published plans and their features will appear here." />
            </div>
          )}
        </section>

        {plans.length > 0 && (
          <section>
            <h3 style={{ fontSize: 20 }}>Compare Features</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Every feature included in each published plan, grouped by area.</p>
            <PlanCompare plans={plans} interval={interval} />
          </section>
        )}

        <div className={b.facts}>
          {[
            [<Repeat key="r" size={20} color="var(--blue)" />, 'Change anytime', 'Upgrade, downgrade or cancel from this page.'],
            [<Coins key="c" size={20} color="var(--blue)" />, 'AI credits', 'Credits power AI analysis and generation; see each plan for its allowance.'],
            [<Database key="d" size={20} color="var(--blue)" />, 'Top up when needed', 'Add credit packs without changing your plan.'],
            [<ShieldCheck key="s" size={20} color="var(--blue)" />, 'Secure payments', 'Card details are handled by our payment provider.'],
          ].map(([i, t, x]) => (
            <div key={t as string}>
              {i}
              <span>
                <b>{t}</b>
                {x}
              </span>
            </div>
          ))}
        </div>

        <Grid cols={2}>
          <section>
            <h3 style={{ fontSize: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <CreditCard size={22} color="var(--blue)" /> Payment Method
            </h3>
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Manage your payment method for subscriptions and billing.</p>
            <div className={b.boxed}>
              <EmptyState
                compact
                icon={<CreditCard size={24} />}
                title="No payment method added"
                description="Add a payment method to enable subscriptions and automatic billing."
                action={
                  <Button variant="outline" disabled title="Payment methods are managed by our payment provider and will be available soon">
                    Add Payment Method
                  </Button>
                }
              />
            </div>
          </section>
          <section>
            <h3 style={{ fontSize: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <FileText size={22} color="var(--blue)" /> Billing &amp; Invoices
            </h3>
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>View and download your invoices and billing history.</p>
            <div className={b.boxed}>
              <EmptyState
                compact
                icon={<FileText size={24} />}
                title="No invoices yet"
                description="Your invoices will appear here once you subscribe to a paid plan or purchase credits."
                action={
                  <ButtonLink href="/app/billing/invoices" variant="outline">
                    View Invoices
                  </ButtonLink>
                }
              />
            </div>
          </section>
        </Grid>
      </div>
    </>
  );
}
