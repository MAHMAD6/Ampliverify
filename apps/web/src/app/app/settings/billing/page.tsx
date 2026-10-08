import Link from 'next/link';
import { BarChart3, BookOpen, Coins, Repeat, ShieldCheck, Crown, CreditCard, Database, ExternalLink, FileText, Info } from 'lucide-react';
import { AddCreditsButton, toPacks } from '@/components/app/billing/AddCreditsDialog';
import { Badge, ButtonLink, EmptyState, Grid, IconCircle, Notice } from '@/components/ui';
import { ActionButton, RedirectButton } from '@/components/ui/actions';
import { PlanCatalog, priceFor, type Interval } from '@/components/app/billing/PlanCatalog';
import { PlanCompare } from '@/components/app/billing/PlanCompare';
import { apiGet, apiList } from '@/lib/api';
import { getAppContext } from '@/lib/project';
import type { PublicPlan } from '@/lib/types';
import type { BillingOverview, Invoice } from '@/lib/app-types';
import { formatDate, formatMoney, formatNumber, humanize } from '@/lib/format';
import b from '@/components/app/billing/billing.module.css';

export const metadata = { title: 'Billing & Plan · Settings' };

/** Settings view of billing: subscription, credits, plan catalog, payment method (Stripe portal) and invoices. */
export default async function SettingsBillingPage({ searchParams }: { searchParams: Promise<{ interval?: string; checkout?: string }> }) {
  const sp = await searchParams;
  const plans = await apiList<PublicPlan>('/public/plans');
  const { workspaceId } = await getAppContext();
  const [billingRes, invoicesRes] = workspaceId
    ? await Promise.all([apiGet<BillingOverview>(`/user/workspaces/${workspaceId}/billing`, { auth: true }), apiGet<Invoice[]>(`/user/workspaces/${workspaceId}/invoices`, { auth: true })])
    : [null, null];
  const billing = billingRes?.ok ? billingRes.data : null;
  const invoices = invoicesRes?.ok ? invoicesRes.data : [];
  const sub = billing?.subscription ?? null;
  const interval: Interval = sp.interval === 'annual' && plans.some((p) => priceFor(p, 'ANNUAL')) ? 'ANNUAL' : 'MONTHLY';
  const usedCredits = billing ? Object.entries(billing.creditCosts).reduce((n, [k, c]) => n + c * (billing.usage.find((u) => u.featureKey === k)?.units ?? 0), 0) : null;
  const included = billing?.features?.find((f) => f.featureKey === 'credits.monthly_grant')?.limit ?? null;

  return (
    <>
      <h2>Billing &amp; Plan</h2>
      <p>View your current plan, manage billing, and access invoices.</p>
      {sp.checkout === 'success' && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="green" title="Subscription confirmed">Your plan updates as soon as the payment provider confirms the subscription (usually within a minute).</Notice>
        </div>
      )}
      <div style={{ display: 'grid', gap: 16 }}>
        <div className={b.planCard}>
          <IconCircle tone="blue" size={72}>
            <Crown size={32} />
          </IconCircle>
          <div>
            <h3>Current Plan</h3>
            <strong>{billing?.plan.name ?? 'No active plan'}</strong>
            {sub ? (
              <p>
                <Badge tone={sub.status === 'ACTIVE' || sub.status === 'TRIALING' ? 'green' : 'amber'}>{humanize(sub.status)}</Badge>{' '}
                {sub.amountMinor && sub.currency ? `${formatMoney(sub.amountMinor, sub.currency)} / ${sub.interval === 'ANNUAL' ? 'year' : 'month'} · ` : ''}
                {sub.cancelAtPeriodEnd ? `Ends on ${formatDate(sub.currentPeriodEnd)}` : `Renews on ${formatDate(sub.currentPeriodEnd)}`}
              </p>
            ) : (
              <p>{billing?.plan.name ? 'Applied to your workspace by default.' : 'Choose a plan to unlock more audits, AI actions and AI search checks.'}</p>
            )}
          </div>
          <div className={b.planActions}>
            {sub && workspaceId ? (
              <>
                <RedirectButton path={`/user/workspaces/${workspaceId}/billing/portal`}>Manage Subscription</RedirectButton>
                <ActionButton variant="ghost" path={`/user/workspaces/${workspaceId}/billing/cancel`} body={{ cancel: !sub.cancelAtPeriodEnd }} confirm={sub.cancelAtPeriodEnd ? undefined : 'Cancel at the end of the current period? You keep access until then.'}>
                  {sub.cancelAtPeriodEnd ? 'Resume Subscription' : 'Cancel Subscription'}
                </ActionButton>
              </>
            ) : (
              <>
                <ButtonLink href="/app/billing" size="lg">
                  View Plans
                </ButtonLink>
                <Link href="/app/billing">Compare Plans</Link>
              </>
            )}
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
              ['Current Balance', billing ? formatNumber(billing.credits.balance) : '—', 'Credits available'],
              ['Included This Period', included !== null ? formatNumber(included) : '—', 'From your plan'],
              ['Used This Period', usedCredits !== null ? formatNumber(usedCredits) : '—', 'Credits used'],
              ['Next Renewal', sub ? formatDate(sub.currentPeriodEnd) : '—', sub ? 'Subscription renewal' : 'No subscription'],
            ].map(([label, value, note]) => (
              <div key={label} className={b.tile}>
                <span>
                  {label} <Info size={14} color="var(--muted)" />
                </span>
                <strong>{value}</strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <AddCreditsButton packs={toPacks(billing?.creditPacks ?? [])} balance={billing ? Number(billing.credits.balance) : null} workspaceId={workspaceId} paymentsEnabled={!!billing?.paymentsEnabled} />
            <ButtonLink href="/app/usage" variant="outline" size="lg" icon={<BarChart3 size={18} />}>
              View Usage &amp; History
            </ButtonLink>
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 20 }}>Plan Features</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>View the key features included in each plan and find the right plan for your needs.</p>
          {plans.length > 0 ? (
            <PlanCatalog plans={plans} interval={interval} basePath="/app/settings/billing" currentCode={billing?.plan.code ?? null} workspaceId={workspaceId} paymentsEnabled={!!billing?.paymentsEnabled && !sub} />
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
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Cards and billing details are managed securely by our payment provider.</p>
            <div className={b.boxed}>
              <EmptyState
                compact
                icon={<CreditCard size={24} />}
                title={sub ? 'Managed in the billing portal' : 'No payment method added'}
                description={sub ? 'Update your card, billing address and tax details in the secure portal.' : 'Your payment method is added during checkout.'}
                action={
                  sub && workspaceId ? (
                    <RedirectButton variant="outline" path={`/user/workspaces/${workspaceId}/billing/portal`}>
                      Manage Payment Method
                    </RedirectButton>
                  ) : (
                    <ButtonLink href="/app/billing" variant="outline">
                      Choose a Plan
                    </ButtonLink>
                  )
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
              {invoices.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                  {invoices.slice(0, 5).map((inv) => (
                    <li key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>{formatDate(inv.issuedAt ?? inv.createdAt)}</span>
                      <span>{formatMoney(inv.totalMinor, inv.currency)}</span>
                      <Badge tone={inv.status === 'PAID' ? 'green' : 'amber'}>{humanize(inv.status)}</Badge>
                    </li>
                  ))}
                  <li>
                    <Link href="/app/billing/invoices" style={{ color: 'var(--blue)' }}>
                      View all invoices →
                    </Link>
                  </li>
                </ul>
              ) : (
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
              )}
            </div>
          </section>
        </Grid>
      </div>
    </>
  );
}
