import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Database,
  FileText,
  Info,
  MessageSquare,
  RefreshCw,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import { ButtonLink, Button } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import { StateView } from '@/components/ui/StateView';
import { AddCreditsButton } from '@/components/app/billing/AddCreditsDialog';
import { UsageHeader } from '@/components/app/usage/UsageHeader';
import s from '@/components/app/usage/usage.module.css';

export const metadata = { title: 'Usage & Credits' };

/** Feature usage cards from the design: credit-metered features and plan-limited (non-credit) ones. */
const FEATURES = [
  { title: 'SEO Audits', text: 'Site audits and SEO analysis', icon: <Search size={22} />, credit: true },
  { title: 'AI Content Generations', text: 'Content creation and optimization', icon: <FileText size={22} />, credit: true },
  { title: 'GEO Checks', text: 'AI search monitoring and visibility', icon: <Sparkles size={22} />, credit: true },
  { title: 'Tracked Pages', text: 'Pages being monitored', icon: <FileText size={22} />, credit: false },
  { title: 'Tracked GEO Prompts', text: 'Prompts being monitored', icon: <MessageSquare size={22} />, credit: false },
];

const ACTIONS = [
  { label: 'Run SEO Audit', icon: <Search size={16} /> },
  { label: 'Generate AI Content', icon: <Sparkles size={16} /> },
  { label: 'Run GEO Check', icon: <Sparkles size={16} /> },
];

/**
 * Usage & Credits (chat design 2026-10-06). Balances, usage and costs come
 * from the credit ledger and usage APIs (`credit_wallets`, `credit_ledger`,
 * `usage_events`), which are not exposed yet, so every value is "—" and
 * configuration actions are disabled. Nothing is estimated client-side.
 */
export default function UsagePage() {
  return (
    <>
      <UsageHeader />

      <div className={s.top}>
        <section className={s.card}>
          <h2>
            Current Plan <span className={s.badge}>Not loaded</span>
          </h2>
          <div className={s.big}>—</div>
          <p>Your plan includes monthly credits and access to selected features.</p>
          <div className={s.row}>
            <Button variant="muted" disabled>
              Upgrade Plan
            </Button>
            <ButtonLink href="/app/billing" variant="secondary">
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
              <i /> <span>Included (Monthly)</span> —
            </li>
            <li>
              <i /> <span>Purchased (Add-ons)</span> —
            </li>
            <li className={s.total}>
              <i /> <span>Total Available Credits</span> —
            </li>
          </ul>
        </section>
        <section className={`${s.card} ${s.withIcon}`}>
          <span className={s.roundIcon}>
            <Database size={24} />
          </span>
          <div>
            <h2>Buy More Credits</h2>
            <p>Purchase additional credits when you need them. Purchased credits may have different expiration rules than plan credits.</p>
            <div className={s.row}>
              <AddCreditsButton packs={[]} balance={null} label="Buy More Credits" variant="outline" size="md" icon={<ShoppingCart size={16} />} />
            </div>
          </div>
        </section>
        <section className={`${s.card} ${s.withIcon}`}>
          <span className={s.roundIcon}>
            <RefreshCw size={24} />
          </span>
          <div style={{ flex: 1 }}>
            <h2 style={{ justifyContent: 'space-between' }}>
              Auto Top-Up <Toggle label="Auto top-up" disabled />
            </h2>
            <p>Automatically purchase credits when your balance is low.</p>
            <span className={s.link}>Configure Auto Top-Up (not available yet)</span>
          </div>
        </section>
      </div>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <div>
            <h2>Feature Usage</h2>
            <p>See how your credits and limits are being used across different features.</p>
          </div>
          <ButtonLink href="/help?q=credits" variant="secondary" icon={<Info size={16} />}>
            How Credits Work
          </ButtonLink>
        </div>
        <div className={s.features}>
          {FEATURES.map((f) => (
            <div key={f.title} className={s.feature}>
              <div className={s.featureHead}>
                <span className={s.featureIcon}>{f.icon}</span>
                <span>
                  <b>{f.title}</b>
                  <small>{f.text}</small>
                </span>
              </div>
              <div className={s.bar} />
              <div className={s.split}>
                <div>
                  Used <b>—</b>
                </div>
                <div>
                  {f.credit ? 'Remaining' : 'Limit'} <b>—</b>
                </div>
              </div>
              <small>{f.credit ? 'Resets each billing period (included credits)' : 'Based on your plan limits (not credit based)'}</small>
            </div>
          ))}
        </div>
      </section>

      <div className={s.two}>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <div>
              <h2>Recent Credit Usage</h2>
              <p>Your latest credit activity across all features.</p>
            </div>
            <Link href="/app/usage/history" className={s.viewAll}>
              View All Activity <ArrowRight size={16} />
            </Link>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Action</th>
                <th>Feature</th>
                <th>Credits Used</th>
                <th>Project</th>
                <th>Status</th>
              </tr>
            </thead>
          </table>
          <StateView kind="empty" compact icon={<FileText size={26} />} title="No usage activity yet" description="Your credit usage will appear here once you start using AmpliVerify." />
        </section>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <div>
              <h2>
                Credit Cost by Action <Info size={16} />
              </h2>
              <p>Each action uses a different number of credits.</p>
            </div>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Action</th>
                <th style={{ textAlign: 'right' }}>Credits per Use</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((a) => (
                <tr key={a.label}>
                  <td style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {a.icon} {a.label}
                  </td>
                  <td style={{ textAlign: 'right' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.note}>
            <Info size={18} />
            <span>Only actions that consume credits are listed here. Some features, such as tracking pages and prompts, may be included in your plan and not consume credits.</span>
          </div>
        </section>
      </div>

      <div className={s.two}>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <div>
              <h2>
                Credit Balance Breakdown <Info size={16} />
              </h2>
              <p>Understand where your available credits come from.</p>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Credit Type</th>
                  <th>Total Credits</th>
                  <th>Used</th>
                  <th>Remaining</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className={s.dot} />
                    Included with Plan (Monthly)
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>Resets each billing period</td>
                </tr>
                <tr>
                  <td>
                    <span className={s.dot} style={{ background: '#4f8cff' }} />
                    Purchased (Add-ons)
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>Varies by purchase</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Total Available</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2>
              <Settings2 size={20} /> Billing &amp; Limits
            </h2>
          </div>
          <ul className={s.kv}>
            <li>
              <CalendarDays size={18} /> <span>Billing Period</span> <span>— to —</span> <span />
            </li>
            <li>
              <CircleDollarSign size={18} /> <span>Monthly Spend Cap</span> <span>Not set</span> <span>Not available yet</span>
            </li>
            <li>
              <RefreshCw size={18} /> <span>Auto Top-Up</span> <span>Disabled</span> <span>Not available yet</span>
            </li>
          </ul>
          <div className={s.note}>
            <Info size={18} />
            <span>Monthly credits reset each billing period. Purchased credits may have different expiration rules and do not reset automatically.</span>
          </div>
        </section>
      </div>
    </>
  );
}
