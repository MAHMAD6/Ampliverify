import Link from 'next/link';
import { ArrowRight, CalendarDays, Database, FileText, Info, KeyRound, MessageSquare, Search, Settings2, ShoppingCart, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { AddCreditsButton, toPacks } from '@/components/app/billing/AddCreditsDialog';
import { UsageHeader } from '@/components/app/usage/UsageHeader';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import type { BillingOverview, LedgerEntry } from '@/lib/app-types';
import { featureLabel, formatDate, formatDateTime, formatNumber, humanize } from '@/lib/format';
import s from '@/components/app/usage/usage.module.css';

export const metadata = { title: 'Usage & Credits' };

/** Usage feature keys → their plan limit keys. */
const FEATURES = [
  { key: 'seo.audit_run', limit: 'limit.audit_runs', title: 'SEO Audits', text: 'Pages analyzed by audits', icon: <Search size={22} /> },
  { key: 'ai.action', limit: 'limit.ai_actions', title: 'AI Content Generations', text: 'Ideas, briefs and editor suggestions', icon: <FileText size={22} /> },
  { key: 'geo.check', limit: 'limit.geo_queries', title: 'GEO Checks', text: 'AI platform answers checked', icon: <Sparkles size={22} /> },
  { key: 'keywords.lookup', limit: 'limit.keyword_lookups', title: 'Keyword Lookups', text: 'Keyword research requests', icon: <KeyRound size={22} /> },
];

type UsageHistory = { daily: { day: string; featureKey: string; units: number }[]; events: { id: string; featureKey: string; units: number; occurredAt: string; project: { id: string; name: string } | null }[] };

const REASON: Record<string, string> = {
  PLAN_GRANT: 'Plan credits',
  PURCHASE: 'Purchase',
  USAGE: 'Usage',
  ADJUSTMENT_CREDIT: 'Adjustment (credit)',
  ADJUSTMENT_DEBIT: 'Adjustment (debit)',
  PROMOTIONAL: 'Promotional credits',
  REFUND: 'Refund',
  REVERSAL: 'Reversal',
  EXPIRATION: 'Expiration',
};

/** Usage & Credits (chat design 2026-10-06): wallet, ledger, usage against plan limits and credit costs. */
export default async function UsagePage({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const { purchase } = await searchParams;
  const { workspaceId } = await getAppContext();
  const [billingRes, ledgerRes, usageRes] = workspaceId
    ? await Promise.all([
        apiGet<BillingOverview>(`/user/workspaces/${workspaceId}/billing`, { auth: true }),
        apiGet<LedgerEntry[]>(`/user/workspaces/${workspaceId}/credits/ledger?limit=200`, { auth: true }),
        apiGet<UsageHistory>(`/user/workspaces/${workspaceId}/usage?days=30`, { auth: true }),
      ])
    : [null, null, null];
  const billing = billingRes?.ok ? billingRes.data : null;
  const ledger = ledgerRes?.ok ? ledgerRes.data : [];
  const usage = usageRes?.ok ? usageRes.data : null;
  const balance = billing ? Number(billing.credits.balance) : null;
  const sumReason = (...reasons: string[]) => ledger.filter((e) => reasons.includes(e.reason)).reduce((n, e) => n + Number(e.delta), 0);
  const planCredits = sumReason('PLAN_GRANT');
  const purchased = sumReason('PURCHASE', 'PROMOTIONAL', 'ADJUSTMENT_CREDIT');
  const spent = -sumReason('USAGE', 'ADJUSTMENT_DEBIT') - sumReason('REVERSAL', 'REFUND') * 0;
  const used = (k: string) => billing?.usage.find((u) => u.featureKey === k)?.units ?? 0;
  const limit = (k: string) => billing?.limits.find((l) => l.featureKey === k)?.limit ?? null;
  const costs = Object.entries(billing?.creditCosts ?? {}).filter(([, v]) => v > 0);

  return (
    <>
      <UsageHeader periodStart={billing?.periodStart} periodEnd={billing?.periodEnd} />

      {purchase === 'success' && (
        <div className={s.note} style={{ marginBottom: 16 }}>
          <Info size={18} />
          <span>Thank you! Your credits are added as soon as the payment is confirmed (usually within a minute).</span>
        </div>
      )}

      <div className={s.top}>
        <section className={s.card}>
          <h2>
            Current Plan <span className={s.badge}>{billing?.subscription?.status ? humanize(billing.subscription.status) : billing ? 'Active' : 'Not loaded'}</span>
          </h2>
          <div className={s.big}>{billing?.plan.name ?? (billing ? 'No plan' : '—')}</div>
          <p>Your plan sets monthly credits and usage limits.</p>
          <div className={s.row}>
            <ButtonLink href="/app/billing">Upgrade Plan</ButtonLink>
            <ButtonLink href="/app/settings/billing" variant="secondary">
              View Plan Details
            </ButtonLink>
          </div>
        </section>
        <section className={s.card}>
          <h2>
            Credit Balances <Info size={15} />
          </h2>
          <ul className={s.balances}>
            <li>
              <i /> <span>Plan credits received</span> {billing ? formatNumber(planCredits) : '—'}
            </li>
            <li>
              <i /> <span>Purchased & bonus credits</span> {billing ? formatNumber(purchased) : '—'}
            </li>
            <li className={s.total}>
              <i /> <span>Total Available Credits</span> {balance === null ? '—' : formatNumber(balance)}
            </li>
          </ul>
        </section>
        <section className={`${s.card} ${s.withIcon}`}>
          <span className={s.roundIcon}>
            <Database size={24} />
          </span>
          <div>
            <h2>Buy More Credits</h2>
            <p>Purchase additional credits when you need them. Purchased credits do not reset with your billing period.</p>
            <div className={s.row}>
              <AddCreditsButton packs={toPacks(billing?.creditPacks ?? [])} balance={balance} workspaceId={workspaceId} paymentsEnabled={!!billing?.paymentsEnabled} label="Buy More Credits" variant="outline" size="md" icon={<ShoppingCart size={16} />} />
            </div>
          </div>
        </section>
        <section className={`${s.card} ${s.withIcon}`}>
          <span className={s.roundIcon}>
            <MessageSquare size={24} />
          </span>
          <div style={{ flex: 1 }}>
            <h2>Credits used this period</h2>
            <div className={s.big}>{billing ? formatNumber(spent) : '—'}</div>
            <p>Failed operations are refunded automatically.</p>
          </div>
        </section>
      </div>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <div>
            <h2>Feature Usage</h2>
            <p>Usage this billing period against your plan limits.</p>
          </div>
          <ButtonLink href="/help?q=credits" variant="secondary" icon={<Info size={16} />}>
            How Credits Work
          </ButtonLink>
        </div>
        <div className={s.features}>
          {FEATURES.map((f) => {
            const u = used(f.key);
            const l = limit(f.limit);
            return (
              <div key={f.title} className={s.feature}>
                <div className={s.featureHead}>
                  <span className={s.featureIcon}>{f.icon}</span>
                  <span>
                    <b>{f.title}</b>
                    <small>{f.text}</small>
                  </span>
                </div>
                <div className={s.bar}>{l ? <i style={{ display: 'block', height: '100%', borderRadius: 'inherit', background: u >= l ? 'var(--red)' : 'var(--blue)', width: `${Math.min(100, (u / l) * 100)}%` }} /> : null}</div>
                <div className={s.split}>
                  <div>
                    Used <b>{billing ? formatNumber(u) : '—'}</b>
                  </div>
                  <div>
                    Limit <b>{l === null ? (billing ? 'No limit' : '—') : formatNumber(l)}</b>
                  </div>
                </div>
                <small>{billing?.creditCosts[f.key] ? `${billing.creditCosts[f.key]} credit(s) per unit` : 'Included in your plan (no credits)'}</small>
              </div>
            );
          })}
        </div>
      </section>

      <div className={s.two}>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <div>
              <h2>Recent Usage</h2>
              <p>Your latest metered activity across all features.</p>
            </div>
            <Link href="/app/usage/history" className={s.viewAll}>
              View Credit History <ArrowRight size={16} />
            </Link>
          </div>
          {usage?.events.length ? (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Feature</th>
                  <th>Units</th>
                  <th>Credits</th>
                  <th>Project</th>
                </tr>
              </thead>
              <tbody>
                {usage.events.slice(0, 12).map((e) => (
                  <tr key={e.id}>
                    <td>{formatDateTime(e.occurredAt)}</td>
                    <td>{featureLabel(e.featureKey)}</td>
                    <td>{formatNumber(e.units)}</td>
                    <td>{billing?.creditCosts[e.featureKey] ? formatNumber(billing.creditCosts[e.featureKey] * e.units) : 0}</td>
                    <td>{e.project?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <StateView kind="empty" compact icon={<FileText size={26} />} title="No usage activity yet" description="Your usage will appear here once you start using AmpliVerify." />
          )}
        </section>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <div>
              <h2>
                Credit Cost by Action <Info size={16} />
              </h2>
              <p>Credits charged per unit of each action.</p>
            </div>
          </div>
          {costs.length ? (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th style={{ textAlign: 'right' }}>Credits per Use</th>
                </tr>
              </thead>
              <tbody>
                {costs.map(([k, v]) => (
                  <tr key={k}>
                    <td>{featureLabel(k)}</td>
                    <td style={{ textAlign: 'right' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={s.note}>
              <Info size={18} />
              <span>No actions currently consume credits — usage is governed by your plan limits.</span>
            </div>
          )}
        </section>
      </div>

      <div className={s.two}>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>Recent Credit Activity</h2>
          </div>
          {ledger.length ? (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Credits</th>
                </tr>
              </thead>
              <tbody>
                {ledger.slice(0, 8).map((e) => (
                  <tr key={e.id}>
                    <td>{formatDateTime(e.createdAt)}</td>
                    <td>{REASON[e.reason] ?? humanize(e.reason)}</td>
                    <td style={{ textAlign: 'right', color: Number(e.delta) < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {Number(e.delta) > 0 ? '+' : ''}
                      {formatNumber(e.delta, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <StateView kind="empty" compact icon={<Database size={26} />} title="No credit activity yet" description="Grants, purchases and usage appear here." />
          )}
        </section>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>
              <Settings2 size={20} /> Billing &amp; Limits
            </h2>
          </div>
          <ul className={s.kv}>
            <li>
              <CalendarDays size={18} /> <span>Billing Period</span> <span>{billing ? `${formatDate(billing.periodStart)} to ${billing.periodEnd ? formatDate(billing.periodEnd) : 'month end'}` : '—'}</span> <span />
            </li>
            <li>
              <Info size={18} /> <span>Low-credit alert</span> <span>{billing?.credits.lowThreshold ? `Below ${billing.credits.lowThreshold} credits` : 'Not set'}</span> <span />
            </li>
          </ul>
          <div className={s.note}>
            <Info size={18} />
            <span>Plan limits reset each billing period. Purchased credits never expire with the period.</span>
          </div>
        </section>
      </div>
    </>
  );
}
