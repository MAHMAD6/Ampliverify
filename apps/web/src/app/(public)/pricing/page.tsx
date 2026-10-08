import Link from 'next/link';
import { ArrowRight, BarChart3, Building2, Check, Coins, Repeat, Rocket, ShieldCheck, Sprout, Users, Minus } from 'lucide-react';
import { apiList } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { PublicPlan } from '@/lib/types';
import s from '@/components/public/site.module.css';

export const metadata = { title: 'Pricing' };

type Interval = 'MONTHLY' | 'ANNUAL';
const ICONS = [Sprout, Rocket, BarChart3, Users, Building2];
const MODULE_NAMES: Record<string, string> = { workspace: 'Projects & Usage Limits', seo_audit: 'Core SEO Tools', seo_editor: 'Core SEO Tools', content: 'Core SEO Tools', geo: 'AI Search (GEO)', ai: 'AI Features', reports: 'Analysis & Reporting' };

const priceFor = (p: PublicPlan, i: Interval) => p.prices.find((x) => x.billingInterval === i) ?? null;
const label = (e: PublicPlan['entitlements'][number] | undefined) => {
  if (!e || !e.enabled) return null;
  if (e.feature.valueType === 'LIMIT') return e.limitNumeric ? Number(e.limitNumeric).toLocaleString('en-US') : 'Unlimited';
  return true;
};

const FAQ = [
  ['Is there a free plan?', 'Yes — when a free plan is published it appears above with its limits. You can upgrade whenever you need more.'],
  ['What are AI credits?', 'Credits are used for AI analysis, content generation, GEO tracking and premium features. Each action shows its credit cost before it runs.'],
  ['What is AI Search (GEO)?', 'Generative engine optimization helps your content be understood and cited by AI assistants and answer engines.'],
  ['How much do I save with annual billing?', 'Annual prices are shown when you switch to Annual; the saving is calculated from the published prices.'],
  ['Can I change or cancel my plan?', 'Yes. Upgrade, downgrade or cancel at any time from Billing & Plan in your account.'],
  ['How are payments handled?', 'Payments are processed securely by our payment provider. AmpliVerify never stores card details.'],
];

/**
 * Pricing (public-website-v2/04). Plans, prices, features and the comparison
 * come only from `GET /public/plans`; nothing from the mockup is hard-coded.
 * The plan an admin marks as recommended is badged "Most Popular".
 */
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ interval?: string }> }) {
  const plans = await apiList<PublicPlan>('/public/plans');
  const hasAnnual = plans.some((p) => priceFor(p, 'ANNUAL'));
  const interval: Interval = (await searchParams).interval === 'annual' && hasAnnual ? 'ANNUAL' : 'MONTHLY';
  let saving = 0;
  for (const p of plans) {
    const m = priceFor(p, 'MONTHLY');
    const a = priceFor(p, 'ANNUAL');
    if (m && a && Number(m.amountMinor) > 0) saving = Math.max(saving, Math.floor((1 - Number(a.amountMinor) / (Number(m.amountMinor) * 12)) * 100));
  }
  const features = new Map<string, { name: string; group: string }>();
  for (const p of plans) for (const e of p.entitlements) features.set(e.feature.key, { name: e.feature.name, group: MODULE_NAMES[e.feature.moduleKey ?? ''] ?? 'Other' });
  const groups = [...new Set([...features.values()].map((f) => f.group))];

  return (
    <>
      <section className={s.hero} style={{ paddingBottom: 40 }}>
        <div className={`${s.container} ${s.center}`}>
          <div className={s.eyebrow}>Pricing</div>
          <h1 className={s.h1}>Plans That Fit Your SEO Goals</h1>
          <p className={s.lead}>Start free. Upgrade, downgrade, or cancel your plan at any time.</p>
          {hasAnnual && (
            <div style={{ marginTop: 22 }}>
              <span className={s.toggle} role="group" aria-label="Billing interval">
                <Link href="/pricing" aria-current={interval === 'MONTHLY'}>
                  Monthly
                </Link>
                <Link href="/pricing?interval=annual" aria-current={interval === 'ANNUAL'}>
                  Annual
                </Link>
                {saving > 0 && <span className={s.save}>Save up to {saving}%</span>}
              </span>
            </div>
          )}
        </div>
      </section>
      <section style={{ paddingBottom: 56 }}>
        <div className={s.container}>
          {plans.length === 0 ? (
            <div className={s.card} style={{ textAlign: 'center', marginTop: 30 }}>
              <h2 className={s.cardTitle}>Plans are being finalized</h2>
              <p className={s.cardText}>Published plans and prices will appear here. Contact us if you have questions in the meantime.</p>
              <Link href="/contact" className={s.btnOutline} style={{ marginTop: 16 }}>
                Contact Sales
              </Link>
            </div>
          ) : (
            <div className={s.plans} style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 5)}, minmax(0, 1fr))` }}>
              {plans.map((p, i) => {
                const Icon = ICONS[i % ICONS.length];
                const price = priceFor(p, interval);
                return (
                  <article key={p.code} className={s.plan} data-featured={p.isFeatured || undefined} style={p.isFeatured ? { borderColor: 'var(--g900)', boxShadow: '0 12px 30px rgba(5, 46, 22, 0.12)', position: 'relative' } : undefined}>
                    {p.isFeatured && (
                      <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--g900)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>Most Popular</span>
                    )}
                    <span className={s.icon}>
                      <Icon size={22} />
                    </span>
                    <h3>{p.name}</h3>
                    <p>{p.description}</p>
                    <div className={s.price}>{price ? formatMoney(price.amountMinor, price.currency) : 'Custom'}</div>
                    <div className={s.per}>{price ? (interval === 'MONTHLY' ? 'per month' : 'per year') : 'Contact us for pricing'}</div>
                    {price ? (
                      <Link href={`/signup?plan=${encodeURIComponent(p.code)}`} className={`${p.isFeatured ? s.btn : s.btnOutline} ${s.sm}`}>
                        {Number(price.amountMinor) === 0 ? 'Get Started Free' : `Choose ${p.name}`}
                      </Link>
                    ) : (
                      <Link href="/contact" className={`${s.btn} ${s.sm}`}>
                        Contact Sales
                      </Link>
                    )}
                    <ul className={s.planList}>
                      {p.entitlements
                        .filter((e) => e.enabled)
                        .map((e) => (
                          <li key={e.feature.key}>
                            <Check size={16} /> {e.feature.valueType === 'LIMIT' ? `${label(e)} ${e.feature.name.toLowerCase()}` : e.feature.name}
                          </li>
                        ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}
          <div className={s.grid4} style={{ marginTop: 22 }}>
            {[
              ['All plans include AI credits', 'Credits are used for AI analysis, content generation, GEO tracking, and premium features.', <Coins key="c" size={20} />],
              ['Change or cancel anytime', 'Upgrade, downgrade, or cancel your plan at any time.', <Repeat key="r" size={20} />],
              ['Secure payments', 'All payments are processed securely by our payment provider.', <ShieldCheck key="s" size={20} />],
              ['Start small', 'Try the essentials and upgrade when you’re ready.', <Sprout key="f" size={20} />],
            ].map(([t, x, i]) => (
              <div key={t as string} className={s.card} style={{ display: 'flex', gap: 12, padding: 18 }}>
                <span className={s.icon} style={{ width: 42, height: 42 }}>
                  {i}
                </span>
                <span>
                  <b style={{ fontSize: 14 }}>{t}</b>
                  <p className={s.cardText} style={{ fontSize: 13 }}>
                    {x}
                  </p>
                </span>
              </div>
            ))}
          </div>
          {features.size > 0 && (
            <>
              <div className={s.center} style={{ marginTop: 64 }}>
                <div className={s.eyebrow}>Compare Plans</div>
                <h2 className={s.h2}>Every Feature, Side by Side</h2>
              </div>
              <div className={s.compare}>
                <table>
                  <thead>
                    <tr>
                      <th>Features</th>
                      {plans.map((p) => {
                        const pr = priceFor(p, interval);
                        return (
                          <th key={p.code}>
                            {p.name}
                            <small>{pr ? `${formatMoney(pr.amountMinor, pr.currency)}/${interval === 'MONTHLY' ? 'mo' : 'yr'}` : 'Custom'}</small>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <FeatureGroup key={g} title={g} plans={plans} rows={[...features].filter(([, f]) => f.group === g)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
      <section className={s.section}>
        <div className={`${s.container} ${s.faq}`}>
          <div>
            <div className={s.eyebrow}>FAQ</div>
            <h2 className={s.h2}>Questions, Answered</h2>
            <p className={s.cardText}>
              Can&apos;t find what you need?{' '}
              <Link href="/contact" style={{ fontWeight: 700 }}>
                Contact our team.
              </Link>
            </p>
          </div>
          <div>
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function FeatureGroup({ title, plans, rows }: { title: string; plans: PublicPlan[]; rows: [string, { name: string }][] }) {
  return (
    <>
      <tr>
        <td colSpan={plans.length + 1} style={{ background: '#f4faf6', fontWeight: 700 }}>
          {title}
        </td>
      </tr>
      {rows.map(([key, f]) => (
        <tr key={key}>
          <td>{f.name}</td>
          {plans.map((p) => {
            const v = label(p.entitlements.find((e) => e.feature.key === key));
            return <td key={p.code}>{v === null ? <Minus size={16} color="#9aa7b4" aria-label="Not included" /> : v === true ? <Check size={16} color="#15803d" aria-label="Included" /> : v}</td>;
          })}
        </tr>
      ))}
    </>
  );
}
