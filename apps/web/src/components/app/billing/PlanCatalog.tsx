import Link from 'next/link';
import { BarChart3, Building2, CheckCircle2, Rocket, Sprout, Users, XCircle } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import type { PublicPlan } from '@/lib/types';
import s from './plans.module.css';

export type Interval = 'MONTHLY' | 'ANNUAL';

const ICONS = [Sprout, Rocket, BarChart3, Users, Building2];
const TONES = ['slate', 'blue', 'green', 'purple', 'amber'];

export function priceFor(plan: PublicPlan, interval: Interval) {
  return plan.prices.find((p) => p.billingInterval === interval) ?? null;
}

type Entitlement = PublicPlan['entitlements'][number];

function limitLabel(e: Entitlement | undefined) {
  if (!e || !e.enabled) return null;
  if (e.feature.valueType === 'LIMIT') return e.limitNumeric ? Number(e.limitNumeric).toLocaleString('en-US') : 'Unlimited';
  return 'Included';
}

/** Largest annual saving across plans, from real prices only (0 when not computable). */
export function annualSaving(plans: PublicPlan[]) {
  let best = 0;
  for (const plan of plans) {
    const m = priceFor(plan, 'MONTHLY');
    const a = priceFor(plan, 'ANNUAL');
    if (!m || !a || m.currency !== a.currency) continue;
    const monthly = Number(m.amountMinor) * 12;
    if (monthly > 0) best = Math.max(best, 1 - Number(a.amountMinor) / monthly);
  }
  return Math.floor(best * 100);
}

/**
 * Plan picker from the Billing & Plan design (user-settings/Billing_Plan_Plans.webp).
 * Plans, prices, features and the comparison table come only from
 * `GET /public/plans`. The current plan needs the subscription API, so no plan
 * is marked current yet, and plan changes stay disabled until checkout exists.
 * A plan without a price for the interval is a sales-led plan: "Custom".
 */
export function PlanCatalog({ plans, interval, basePath, currentCode = null }: { plans: PublicPlan[]; interval: Interval; basePath: string; currentCode?: string | null }) {
  const hasAnnual = plans.some((p) => priceFor(p, 'ANNUAL'));
  const saving = annualSaving(plans);
  const features = new Map<string, string>();
  for (const plan of plans) for (const e of plan.entitlements) features.set(e.feature.key, e.feature.name);

  return (
    <>
      {hasAnnual && (
        <div className={s.intervalBar}>
          <div className={s.interval} role="group" aria-label="Billing interval">
            <Link href={basePath} aria-current={interval === 'MONTHLY'}>
              Monthly
            </Link>
            <Link href={`${basePath}?interval=annual`} aria-current={interval === 'ANNUAL'}>
              Annual
            </Link>
          </div>
          {saving > 0 && <span className={s.save}>Save up to {saving}%</span>}
        </div>
      )}

      <div className={s.cards} style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 5)}, minmax(0, 1fr))` }}>
        {plans.map((plan, i) => {
          const Icon = ICONS[i % ICONS.length];
          const price = priceFor(plan, interval);
          const current = plan.code === currentCode;
          return (
            <article key={plan.code} className={s.card} data-tone={TONES[i % TONES.length]}>
              <span className={s.icon}>
                <Icon size={30} />
              </span>
              <h3>{plan.name}</h3>
              {plan.description && <p className={s.desc}>{plan.description}</p>}
              <div className={s.price}>{price ? formatMoney(price.amountMinor, price.currency) : 'Custom'}</div>
              <div className={s.per}>{price ? (interval === 'MONTHLY' ? 'per month' : 'per year') : 'Contact sales for pricing.'}</div>
              {current ? (
                <Button variant="muted" block disabled>
                  Current Plan
                </Button>
              ) : price ? (
                <Button variant="outline" block disabled title="Plan changes will be available once billing is enabled for your workspace.">
                  {Number(price.amountMinor) === 0 ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`}
                </Button>
              ) : (
                <ButtonLink href="/contact" block>
                  Contact Sales
                </ButtonLink>
              )}
              <ul className={s.features}>
                {plan.entitlements.map((e) => {
                  const label = limitLabel(e);
                  return (
                    <li key={e.feature.key} className={e.enabled ? undefined : s.off}>
                      {e.enabled ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      {e.feature.valueType === 'LIMIT' && label ? `${label} ${e.feature.name.toLowerCase()}` : e.feature.name}
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>

      {features.size > 0 && (
        <section className={s.compare}>
          <h2>Compare Plans</h2>
          <p>See what’s included in each plan.</p>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  {plans.map((p) => {
                    const price = priceFor(p, interval);
                    return (
                      <th key={p.code}>
                        {p.name}
                        <small>{price ? `${formatMoney(price.amountMinor, price.currency)}/${interval === 'MONTHLY' ? 'mo' : 'yr'}` : 'Custom'}</small>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[...features].map(([key, name]) => (
                  <tr key={key}>
                    <td>{name}</td>
                    {plans.map((p) => {
                      const e = p.entitlements.find((x) => x.feature.key === key);
                      const label = limitLabel(e);
                      return (
                        <td key={p.code}>
                          {label === null ? (
                            <XCircle size={16} className={s.no} aria-label="Not included" />
                          ) : label === 'Included' ? (
                            <CheckCircle2 size={16} className={s.yes} aria-label="Included" />
                          ) : (
                            label
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
