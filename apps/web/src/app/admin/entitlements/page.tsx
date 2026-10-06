import Link from 'next/link';
import { BarChart3, FileSearch, FileText, Folder, Info, KeyRound, Layers, LineChart, PenSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { apiList } from '@/lib/api';
import type { PublicPlan } from '@/lib/types';
import s from '@/components/admin/entitlements.module.css';

export const metadata = { title: 'Feature Entitlements' };

/** Modules from the design, mapped to `features.module_key` in the seeded registry (null = not in the registry yet). */
const MODULES = [
  { key: 'seo_audit', label: 'On-Page SEO Audit', text: 'Analyze pages for technical, SEO, and content issues.', icon: <FileSearch size={20} />, tone: 'blue' },
  { key: null, label: 'Optimization Center', text: 'Get AI-powered optimization recommendations.', icon: <LineChart size={20} />, tone: 'green' },
  { key: 'seo_editor', label: 'On-Page SEO Editor', text: 'Optimize content with real-time SEO guidance.', icon: <PenSquare size={20} />, tone: 'blue' },
  { key: 'content', label: 'Content Strategy', text: 'Plan topics, clusters, and content outlines.', icon: <FileText size={20} />, tone: 'purple' },
  { key: null, label: 'Keyword Research', text: 'Find and analyze keywords and search intent.', icon: <KeyRound size={20} />, tone: 'red' },
  { key: 'geo', label: 'AI Search (GEO)', text: 'Optimize for AI search and generative engines.', icon: <Sparkles size={20} />, tone: 'purple' },
  { key: 'reports', label: 'Reports', text: 'Generate and share SEO reports.', icon: <BarChart3 size={20} />, tone: 'green' },
  { key: 'workspace', label: 'Projects', text: 'Manage websites and SEO projects.', icon: <Folder size={20} />, tone: 'blue' },
] as const;

type Access = 'ENABLED' | 'LIMITED' | 'DISABLED';

/** Effective access for a module from a plan's entitlements: a limit makes it Limited, an enabled flag Enabled. */
function accessFor(plan: PublicPlan, moduleKey: string): { access: Access; limit: string | null } {
  const own = plan.entitlements.filter((e) => e.feature.moduleKey === moduleKey && e.enabled);
  const limit = own.find((e) => e.feature.valueType === 'LIMIT');
  if (limit) return { access: 'LIMITED', limit: limit.limitNumeric ? `${Number(limit.limitNumeric).toLocaleString('en-US')} ${limit.feature.name.toLowerCase()}` : 'Unlimited' };
  if (own.length) return { access: 'ENABLED', limit: null };
  return { access: 'DISABLED', limit: null };
}

/**
 * Feature Entitlements (chat design 2026-10-06). Plans and their
 * entitlements are live from `GET /public/plans`; editing needs the admin
 * plans API, so the matrix is read-only and Save/Reset are disabled.
 */
export default async function EntitlementsPage({ searchParams }: { searchParams: Promise<{ plan?: string; module?: string; q?: string }> }) {
  const { plan: code, module: only, q } = await searchParams;
  const plans = await apiList<PublicPlan>('/public/plans');
  const plan = plans.find((p) => p.code === code) ?? null;
  const term = q?.trim().toLowerCase();
  const rows = MODULES.filter((m) => (!only || m.label === only) && (!term || m.label.toLowerCase().includes(term)));
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        title="Feature Entitlements"
        description="Manage which features are available in each plan. Set access levels and limits for the selected plan."
        actions={
          <>
            <Button variant="outline" disabled>
              Reset Changes
            </Button>
            <Button disabled title="Editing entitlements needs the admin plans API.">
              Save Changes
            </Button>
          </>
        }
      />
      <section className={s.select}>
        <form>
          <label htmlFor="plan">Select Plan to Configure</label>
          <AutoSubmitSelect id="plan" name="plan" defaultValue={plan?.code ?? ''}>
            <option value="">Select a plan</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <button type="submit">Load</button>
          </noscript>
        </form>
        <div className={s.selected}>
          <span className={s.bigIcon}>
            <Layers size={30} />
          </span>
          <div>
            <b>{plan ? plan.name : plans.length ? 'No plan selected' : 'No plans available'}</b>
            <p>{plan ? plan.description ?? 'Entitlements for this plan are shown below.' : 'Choose a plan to view and configure its feature entitlements.'}</p>
          </div>
        </div>
      </section>
      <div className={s.layout}>
        <aside className={s.modules}>
          <form>
            {plan && <input type="hidden" name="plan" value={plan.code} />}
            <input name="q" defaultValue={q} placeholder="Search features..." aria-label="Search features" className={s.search} />
          </form>
          <Link href={plan ? `?plan=${plan.code}` : '?'} className={!only ? s.on : undefined}>
            <Layers size={18} /> All Features
          </Link>
          {MODULES.map((m) => (
            <Link key={m.label} href={`?${new URLSearchParams({ ...(plan && { plan: plan.code }), module: m.label })}`} className={only === m.label ? s.on : undefined}>
              {m.icon} {m.label}
            </Link>
          ))}
        </aside>
        <section className={s.matrix}>
          <h2>Feature Entitlements</h2>
          <p>Access and limits for each feature in the selected plan.</p>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Feature / Module</th>
                  <th>Description</th>
                  <th>Access</th>
                  <th>Usage Limit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const v = plan && m.key ? accessFor(plan, m.key) : null;
                  return (
                    <tr key={m.label}>
                      <td>
                        <span className={s.feature}>
                          <span className={s.icon} data-tone={m.tone}>
                            {m.icon}
                          </span>
                          <b>{m.label}</b>
                        </span>
                      </td>
                      <td className={s.desc}>{m.text}</td>
                      <td>
                        {m.key ? (
                          <span className={s.radios} role="radiogroup" aria-label={`${m.label} access`}>
                            {(['ENABLED', 'LIMITED', 'DISABLED'] as Access[]).map((a) => (
                              <label key={a}>
                                <input type="radio" name={m.label} checked={v?.access === a} disabled readOnly /> {a.charAt(0) + a.slice(1).toLowerCase()}
                              </label>
                            ))}
                          </span>
                        ) : (
                          <span className={s.muted}>Not in the feature registry yet</span>
                        )}
                      </td>
                      <td>{v?.limit ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className={s.notes}>
            <Info size={18} />
            <li>Usage limits apply only when Limited is selected and only for features that support limits.</li>
            <li>Included credits apply only to credit-based features.</li>
            <li>Plan access is separate from Module Controls (global availability) and Feature Flags (rollouts).</li>
          </ul>
        </section>
      </div>
    </>
  );
}
