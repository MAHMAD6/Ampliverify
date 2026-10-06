import Link from 'next/link';
import type { Metadata } from 'next';
import { Hero } from '@/components/public/Hero';
import { EmptyContent } from '@/components/public/ContentList';
import { ButtonLink } from '@/components/ui';
import { apiList } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { PublicPlan } from '@/lib/types';
import s from '@/components/public/public.module.css';

export const metadata: Metadata = { title: 'Pricing' };

type Interval = 'MONTHLY' | 'ANNUAL';

function priceFor(plan: PublicPlan, interval: Interval) {
  return plan.prices.find((p) => p.billingInterval === interval) ?? null;
}

function entitlementLabel(e: PublicPlan['entitlements'][number] | undefined) {
  if (!e || !e.enabled) return '—';
  if (e.feature.valueType === 'LIMIT') return e.limitNumeric ? Number(e.limitNumeric).toLocaleString('en-US') : 'Unlimited';
  return 'Included';
}

/** Prices, limits and plan availability come only from the billing configuration (guide §12). */
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ interval?: string }> }) {
  const plans = await apiList<PublicPlan>('/public/plans');
  const hasAnnual = plans.some((p) => priceFor(p, 'ANNUAL'));
  const interval: Interval = (await searchParams).interval === 'annual' && hasAnnual ? 'ANNUAL' : 'MONTHLY';

  const features = new Map<string, string>();
  for (const plan of plans) for (const e of plan.entitlements) features.set(e.feature.key, e.feature.name);

  return (
    <>
      <Hero eyebrow="Pricing" title="Choose the plan that fits your SEO goals">
        Start free, then move to a paid plan when you need more projects, usage, or advanced capabilities.
      </Hero>
      <section className={s.section} style={{ paddingTop: 24 }}>
        <div className={s.container}>
          {hasAnnual && (
            <div className={s.center} style={{ marginBottom: 28 }}>
              <div className={s.togglebar} role="group" aria-label="Billing interval">
                <Link href="/pricing" aria-current={interval === 'MONTHLY'}>
                  Monthly
                </Link>
                <Link href="/pricing?interval=annual" aria-current={interval === 'ANNUAL'}>
                  Annual
                </Link>
              </div>
            </div>
          )}

          {plans.length === 0 ? (
            <EmptyContent title="Plans are being finalized" text="Published plans and prices will appear here. Contact us if you have questions in the meantime." />
          ) : (
            <>
              <div className={s.pricegrid}>
                {plans.map((plan) => {
                  const price = priceFor(plan, interval);
                  return (
                    <div key={plan.code} className={s.pricecard}>
                      <h3>{plan.name}</h3>
                      {plan.description && <p>{plan.description}</p>}
                      <div className={s.price}>
                        {price ? formatMoney(price.amountMinor, price.currency) : '—'}
                        <small> / {interval === 'MONTHLY' ? 'month' : 'year'}</small>
                      </div>
                      <ButtonLink href={`/app/billing?plan=${encodeURIComponent(plan.code)}`} variant="greenOutline" block>
                        Get Started
                      </ButtonLink>
                      <ul>
                        {plan.entitlements
                          .filter((e) => e.enabled)
                          .map((e) => (
                            <li key={e.feature.key}>
                              {e.feature.valueType === 'LIMIT' ? `${entitlementLabel(e)} ${e.feature.name.toLowerCase()}` : e.feature.name}
                            </li>
                          ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {features.size > 0 && (
                <div className={s.compare}>
                  <table>
                    <thead>
                      <tr>
                        <th>Feature</th>
                        {plans.map((p) => (
                          <th key={p.code}>{p.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...features].map(([key, name]) => (
                        <tr key={key}>
                          <td>{name}</td>
                          {plans.map((p) => (
                            <td key={p.code}>{entitlementLabel(p.entitlements.find((e) => e.feature.key === key))}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
