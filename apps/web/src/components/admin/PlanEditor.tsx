import { Button, ButtonLink, Field, Input, KeyValue, Notice, Panel, Select, SettingRow, Textarea } from '../ui';
import { Toggle } from '../ui/Toggle';
import { AdminHeader } from './AdminParts';
import { formatMoney } from '@/lib/format';
import type { PublicPlan } from '@/lib/types';
import s from './audit.module.css';

/**
 * Plan Detail / Edit (admin-final-batch2/04). Identity, provider-backed
 * billing and public behavior are separate from entitlements (managed in the
 * entitlement matrix). Existing plans are read from `GET /public/plans`; there
 * is no admin plan-write API yet, so the form is read-only and Save Draft /
 * Review Changes are disabled. Live plan changes must be confirmed and audited.
 */
export function PlanEditor({ plan }: { plan: PublicPlan | null }) {
  const monthly = plan?.prices.find((p) => p.billingInterval === 'MONTHLY');
  const annual = plan?.prices.find((p) => p.billingInterval === 'ANNUAL');
  const price = [monthly && `${formatMoney(monthly.amountMinor, monthly.currency)} / month`, annual && `${formatMoney(annual.amountMinor, annual.currency)} / year`].filter(Boolean).join(' · ');
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
          Live pricing and entitlement changes are consequential. They require confirmation, record before/after values, and never silently alter existing subscriptions.
        </Notice>
      </div>
      <div className={s.split} style={{ marginTop: 0 }}>
        <Panel title="Plan Identity" description="The commercial plan record." flushHead>
          <Field label="Plan name" htmlFor="p-name">
            <Input id="p-name" defaultValue={plan?.name} placeholder="Enter plan name" disabled />
          </Field>
          <Field label="Internal code" htmlFor="p-code" hint="Immutable once subscriptions exist.">
            <Input id="p-code" defaultValue={plan?.code} placeholder="Enter immutable identifier" disabled />
          </Field>
          <Field label="Status" htmlFor="p-status">
            <Select id="p-status" disabled defaultValue={plan ? 'ACTIVE' : 'DRAFT'}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </Field>
          <Field label="Public description" htmlFor="p-desc">
            <Textarea id="p-desc" rows={3} defaultValue={plan?.description ?? ''} placeholder="Enter approved plan description." disabled />
          </Field>
        </Panel>
        <Panel title="Billing Configuration" description="Values map to the authoritative billing provider." flushHead>
          <KeyValue label="Billing intervals" value={plan ? [monthly && 'Monthly', annual && 'Annual'].filter(Boolean).join(' / ') || 'None' : undefined} />
          <KeyValue label="Price" value={price || undefined} />
          <KeyValue label="Currency" value={monthly?.currency ?? annual?.currency} />
          <KeyValue label="Provider price ID" value="Not configured" />
        </Panel>
        <Panel title="Public Pricing Behavior" description="How this plan is exposed publicly." flushHead>
          <SettingRow title="Visible on pricing page" description="Show only when the plan is ready for public selection." control={<Toggle label="Visible on pricing page" defaultChecked={!!plan} disabled />} />
          <SettingRow title="Recommended plan" description="Only one plan should be highlighted at a time." control={<Toggle label="Recommended plan" disabled />} />
          <SettingRow title="Allow self-service signup" description="Enable only when checkout supports the plan." control={<Toggle label="Allow self-service signup" disabled />} />
        </Panel>
        <Panel title="Entitlements" description="Feature access is managed through the entitlement matrix." flushHead>
          <KeyValue label="Mapped features" value={plan ? String(enabled.length) : '—'} />
          <KeyValue label="Usage limits" value={plan ? String(limits.length) : '—'} />
          <KeyValue label="Overrides" value="—" />
          <div style={{ marginTop: 12 }}>
            <ButtonLink href="/admin/entitlements" variant="outline">
              Open Feature Entitlements
            </ButtonLink>
          </div>
        </Panel>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <ButtonLink href="/admin/plans" variant="outline">
          Cancel
        </ButtonLink>
        <Button variant="outline" disabled>
          Save Draft
        </Button>
        <Button disabled title="Plan changes need the admin plans API.">
          Review Changes
        </Button>
      </div>
    </>
  );
}
