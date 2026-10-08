'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Select } from '../ui';
import { ApiForm } from '../ui/actions';

type Pack = { code: string; name?: string; credits: number; amountMinor: number; currency: string };

/** What each metered action costs, in credits per unit (`credits.costs`). Unlisted or 0 = free. */
export function CreditCostsForm({ features, costs }: { features: { key: string; label: string; unit: string }[]; costs: Record<string, number> }) {
  const keys = [...features, ...Object.keys(costs).filter((k) => !features.some((f) => f.key === k)).map((k) => ({ key: k, label: k, unit: 'unit' }))];
  return (
    <ApiForm
      method="PUT"
      path="/admin/settings/credits.costs"
      submitLabel="Save Credit Costs"
      successMessage="Credit costs saved."
      transform={(v) => ({ value: Object.fromEntries(keys.map((f) => [f.key, Number(v[`cost_${f.key.replace(/\./g, '~')}`] ?? 0) || 0])) })}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {keys.map((f) => (
          <Field key={f.key} label={`${f.label} (credits per ${f.unit})`} htmlFor={`cost-${f.key}`} hint={f.key}>
            <Input id={`cost-${f.key}`} name={`cost_${f.key.replace(/\./g, '~')}`} type="number" data-type="number" min={0} step="any" defaultValue={costs[f.key] ?? 0} />
          </Field>
        ))}
      </div>
    </ApiForm>
  );
}

/** Purchasable credit packs (`credits.packs`), shown in Add Credits and charged through Stripe Checkout. */
export function CreditPacksForm({ packs: initial }: { packs: Pack[] }) {
  const [packs, setPacks] = useState<Pack[]>(initial);
  const set = (i: number, patch: Partial<Pack>) => setPacks((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <ApiForm method="PUT" path="/admin/settings/credits.packs" submitLabel="Save Credit Packs" successMessage="Credit packs saved." transform={() => ({ value: packs.map((p) => ({ ...p, code: p.code.trim(), currency: p.currency.trim().toUpperCase(), ...(p.name?.trim() ? { name: p.name.trim() } : { name: undefined }) })) })}>
      <div style={{ display: 'grid', gap: 8 }}>
        {packs.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>No packs: customers cannot buy credits.</p>}
        {packs.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) minmax(120px, 1.4fr) 100px 120px 80px auto', gap: 8, alignItems: 'end' }}>
            <Field label="Code" htmlFor={`pk-c-${i}`}>
              <Input id={`pk-c-${i}`} value={p.code} onChange={(e) => set(i, { code: e.target.value })} required pattern="[a-z0-9_-]+" placeholder="starter" />
            </Field>
            <Field label="Name" htmlFor={`pk-n-${i}`}>
              <Input id={`pk-n-${i}`} value={p.name ?? ''} onChange={(e) => set(i, { name: e.target.value })} placeholder="Starter pack" />
            </Field>
            <Field label="Credits" htmlFor={`pk-cr-${i}`}>
              <Input id={`pk-cr-${i}`} type="number" min={1} value={p.credits} onChange={(e) => set(i, { credits: Number(e.target.value) })} required />
            </Field>
            <Field label="Price (minor)" htmlFor={`pk-a-${i}`}>
              <Input id={`pk-a-${i}`} type="number" min={1} step={1} value={p.amountMinor} onChange={(e) => set(i, { amountMinor: Math.round(Number(e.target.value)) })} required />
            </Field>
            <Field label="Currency" htmlFor={`pk-cu-${i}`}>
              <Input id={`pk-cu-${i}`} value={p.currency} maxLength={3} onChange={(e) => set(i, { currency: e.target.value })} required />
            </Field>
            <Button type="button" variant="ghost" aria-label="Remove pack" onClick={() => setPacks((x) => x.filter((_, j) => j !== i))}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setPacks((x) => [...x, { code: '', name: '', credits: 100, amountMinor: 1000, currency: x[0]?.currency ?? 'USD' }])}>
            Add pack
          </Button>
        </div>
      </div>
    </ApiForm>
  );
}

/** Plan used for workspaces without a subscription, and credits granted to new workspaces. */
export function PlanDefaultsForms({ plans, defaultPlan, signupGrant }: { plans: { code: string; name: string }[]; defaultPlan: string | null; signupGrant: number }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ApiForm method="PUT" path="/admin/settings/billing.default_plan_code" submitLabel="Save Default Plan" successMessage="Default plan saved." transform={(v) => ({ value: v.plan || null })}>
        <Field label="Default plan (no subscription)" htmlFor="bd-plan" hint="Limits and features for workspaces that have not subscribed. None = no plan limits.">
          <Select id="bd-plan" name="plan" defaultValue={defaultPlan ?? ''}>
            <option value="">None</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </ApiForm>
      <ApiForm method="PUT" path="/admin/settings/credits.signup_grant" submitLabel="Save Sign-up Credits" successMessage="Sign-up credits saved." transform={(v) => ({ value: Number(v.grant) || 0 })}>
        <Field label="Credits for new workspaces" htmlFor="bd-grant" hint="Granted once when a workspace is created. 0 = none.">
          <Input id="bd-grant" name="grant" type="number" data-type="number" min={0} step={1} defaultValue={signupGrant} />
        </Field>
      </ApiForm>
    </div>
  );
}
