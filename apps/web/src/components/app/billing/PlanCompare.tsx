import { Check, X } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { PublicPlan } from '@/lib/types';
import { priceFor, type Interval } from './PlanCatalog';
import b from './billing.module.css';

const GROUPS: Record<string, string> = { workspace: 'Projects & Usage Limits', seo_audit: 'Core SEO Tools', seo_editor: 'Core SEO Tools', content: 'Content Strategy', keywords: 'Keyword Research', geo: 'AI Search (GEO)', ai: 'AI Features', reports: 'Analysis & Reporting' };

const cell = (e: PublicPlan['entitlements'][number] | undefined) => {
  if (!e || !e.enabled) return <X size={16} color="var(--subtle)" aria-label="Not included" />;
  if (e.feature.valueType === 'LIMIT') return e.limitNumeric ? Number(e.limitNumeric).toLocaleString('en-US') : 'Unlimited';
  return <Check size={16} color="var(--green)" aria-label="Included" />;
};

/**
 * Categorized feature comparison (Settings → Billing & Plan redesign). Rows
 * are the union of published plan entitlements, grouped by module key.
 */
export function PlanCompare({ plans, interval }: { plans: PublicPlan[]; interval: Interval }) {
  const features = new Map<string, { name: string; group: string }>();
  for (const p of plans) for (const e of p.entitlements) features.set(e.feature.key, { name: e.feature.name, group: GROUPS[e.feature.moduleKey ?? ''] ?? 'Other' });
  if (!features.size) return null;
  const groups = [...new Set([...features.values()].map((f) => f.group))];
  return (
    <div className={b.compare}>
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
          {groups.flatMap((g) => [
            <tr key={g} className={b.compareGroup}>
              <td colSpan={plans.length + 1}>{g}</td>
            </tr>,
            ...[...features]
              .filter(([, f]) => f.group === g)
              .map(([key, f]) => (
                <tr key={key}>
                  <td>{f.name}</td>
                  {plans.map((p) => (
                    <td key={p.code}>{cell(p.entitlements.find((e) => e.feature.key === key))}</td>
                  ))}
                </tr>
              )),
          ])}
        </tbody>
      </table>
    </div>
  );
}
