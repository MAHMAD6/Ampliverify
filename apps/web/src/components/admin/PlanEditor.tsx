import { ButtonLink, DataTable, Field, Input, KeyValue, Notice, Panel, Select, SettingRow, Textarea } from '../ui';
import { Toggle } from '../ui/Toggle';
import { ApiForm } from '../ui/actions';
import { AdminHeader } from './AdminParts';
import { StatusPill } from './AdminList';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { AdminPlan } from '@/lib/admin-data';
import s from './audit.module.css';

const STATUS_TONE = { ACTIVE: 'green', DRAFT: 'amber', ARCHIVED: 'slate' } as const;

/**
 * Plan Detail / Edit (admin-final-batch2/04). Identity and public behavior
 * are edited here; prices are append-only (a new price replaces the active
 * one for its interval and syncs to Stripe when configured); entitlements
 * live in the entitlement matrix. Every change is audited by the API.
 */
export function PlanEditor({ plan }: { plan: AdminPlan | null }) {
  const active = plan?.prices.filter((p) => p.active) ?? [];
  const enabled = plan?.entitlements.filter((e) => e.enabled) ?? [];
  const limits = enabled.filter((e) => e.feature.valueType === 'LIMIT');
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        parent={{ label: 'Plans & Pricing', href: '/admin/plans' }}
        page={plan ? plan.name : 'New Plan'}
        title="Plan Detail / Edit"
        description="Create or edit a commercial plan with controlled billing and entitlement behavior."
      />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="neutral" title="Plan editing:">
          Live pricing and entitlement changes are consequential. Changes are audited with before/after values, and existing subscriptions keep the price they signed up with.
        </Notice>
      </div>
      <div className={s.split} style={{ marginTop: 0 }}>
        <Panel title="Plan Identity" description="The commercial plan record." flushHead>
          <ApiForm method={plan ? 'PATCH' : 'POST'} path={plan ? `/admin/plans/${encodeURIComponent(plan.code)}` : '/admin/plans'} submitLabel={plan ? 'Save Plan' : 'Create Plan'} redirectTo={plan ? undefined : '/admin/plans/{code}'}>
            <Field label="Plan name" htmlFor="p-name">
              <Input id="p-name" name="name" required maxLength={120} defaultValue={plan?.name} placeholder="Enter plan name" />
            </Field>
            {plan ? (
              <KeyValue label="Internal code" value={<code>{plan.code}</code>} />
            ) : (
              <Field label="Internal code" htmlFor="p-code" hint="Lowercase letters, numbers and dashes. Cannot be changed later.">
                <Input id="p-code" name="code" required maxLength={64} pattern="[a-z0-9_-]+" placeholder="e.g. pro" />
              </Field>
            )}
            <Field label="Status" htmlFor="p-status" hint="Only Active, public plans appear on the pricing page and in checkout.">
              <Select id="p-status" name="status" defaultValue={plan?.status ?? 'DRAFT'}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </Field>
            <Field label="Public description" htmlFor="p-desc">
              <Textarea id="p-desc" name="description" data-type="nullable" rows={3} maxLength={2000} defaultValue={plan?.description ?? ''} placeholder="Enter approved plan description." />
            </Field>
            <Field label="Display order" htmlFor="p-order" hint="Lower numbers are shown first.">
              <Input id="p-order" name="displayOrder" type="number" data-type="number" step={1} defaultValue={plan?.displayOrder ?? 0} />
            </Field>
            <SettingRow title="Visible on pricing page" description="Show only when the plan is ready for public selection." control={<Toggle label="Visible on pricing page" name="isPublic" defaultChecked={plan?.isPublic ?? false} />} />
            <SettingRow title="Recommended plan" description="Highlighted as “Most Popular”. Only one plan should be highlighted." control={<Toggle label="Recommended plan" name="isFeatured" defaultChecked={plan?.isFeatured ?? false} />} />
          </ApiForm>
        </Panel>
        {plan && (
          <Panel title="Billing Configuration" description="Prices are append-only; a new price replaces the active one for its interval." flushHead>
            <KeyValue label="Status" value={<StatusPill tone={STATUS_TONE[plan.status]}>{plan.status.charAt(0) + plan.status.slice(1).toLowerCase()}</StatusPill>} />
            <KeyValue label="Active subscriptions" value={String(plan._count.subscriptions)} />
            <DataTable
              columns={['Interval', 'Price', 'Stripe price', 'Status', 'Created']}
              rows={plan.prices.map((p) => [
                p.billingInterval === 'MONTHLY' ? 'Monthly' : 'Annual',
                formatMoney(p.amountMinor, p.currency),
                p.providerPriceId ? <code key="c">{p.providerPriceId}</code> : 'Not synced',
                p.active ? 'Active' : 'Replaced',
                formatDateTime(p.createdAt),
              ])}
              empty={<p style={{ padding: 12, color: 'var(--muted)', fontSize: 14 }}>No prices yet. Add a monthly and/or annual price below.</p>}
            />
            <div style={{ marginTop: 12 }}>
              <ApiForm path={`/admin/plans/${encodeURIComponent(plan.code)}/prices`} submitLabel="Add Price" resetOnSuccess successMessage="Price added.">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                  <Field label="Interval" htmlFor="pr-int">
                    <Select id="pr-int" name="billingInterval" defaultValue="MONTHLY">
                      <option value="MONTHLY">Monthly</option>
                      <option value="ANNUAL">Annual</option>
                    </Select>
                  </Field>
                  <Field label="Currency" htmlFor="pr-cur">
                    <Input id="pr-cur" name="currency" required minLength={3} maxLength={3} defaultValue={active[0]?.currency ?? 'USD'} />
                  </Field>
                  <Field label="Amount (minor units)" htmlFor="pr-amt" hint="e.g. 4900 = $49.00">
                    <Input id="pr-amt" name="amountMinor" type="number" data-type="number" min={0} step={1} required />
                  </Field>
                </div>
              </ApiForm>
            </div>
          </Panel>
        )}
        {plan && (
          <Panel title="Entitlements" description="Feature access is managed through the entitlement matrix." flushHead>
            <KeyValue label="Enabled features" value={String(enabled.length)} />
            <KeyValue label="Usage limits" value={String(limits.length)} />
            <div style={{ marginTop: 12 }}>
              <ButtonLink href={`/admin/entitlements?plan=${encodeURIComponent(plan.code)}`} variant="outline">
                Open Feature Entitlements
              </ButtonLink>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
