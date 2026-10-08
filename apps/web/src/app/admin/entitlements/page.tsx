import Link from 'next/link';
import { Info, Layers } from 'lucide-react';
import { DataTable, Field, Input, Panel, Select } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { EntitlementMatrix } from '@/components/admin/EntitlementMatrix';
import { OverrideForm } from '@/components/admin/OverrideForm';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { adminGet, type AdminFeature, type AdminPlan, type AdminWorkspace } from '@/lib/admin-data';
import { formatDate } from '@/lib/format';
import s from '@/components/admin/entitlements.module.css';

export const metadata = { title: 'Feature Entitlements' };

type Override = {
  id: string;
  enabled: boolean;
  limitNumeric: string | null;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  feature: AdminFeature;
  workspace: { id: string; name: string };
  creator: { email: string; displayName: string | null };
};

/**
 * Feature Entitlements (chat design 2026-10-06): the selected plan's access
 * and limits per registered feature, workspace-level overrides, and the
 * feature registry itself. Plan access is separate from Module Controls
 * (global availability) and Feature Flags (rollouts).
 */
export default async function EntitlementsPage({ searchParams }: { searchParams: Promise<{ plan?: string; module?: string; q?: string }> }) {
  const { plan: code, module: only, q } = await searchParams;
  const [plans, features, overrides, workspaces] = await Promise.all([
    adminGet<AdminPlan[]>('/admin/plans'),
    adminGet<AdminFeature[]>('/admin/features'),
    adminGet<Override[]>('/admin/entitlement-overrides'),
    adminGet<AdminWorkspace[]>('/admin/workspaces'),
  ]);
  const planList = plans ?? [];
  const plan = planList.find((p) => p.code === code) ?? planList[0] ?? null;
  const all = features ?? [];
  const modules = [...new Set(all.map((f) => f.moduleKey ?? 'other'))].sort();
  const term = q?.trim().toLowerCase();
  const visible = all.filter((f) => (!only || (f.moduleKey ?? 'other') === only) && (!term || `${f.name} ${f.key}`.toLowerCase().includes(term)));
  const rows = plan
    ? visible.map((f) => {
        const e = plan.entitlements.find((x) => x.feature.key === f.key);
        return { feature: f, enabled: e?.enabled ?? false, limit: e?.limitNumeric ?? null };
      })
    : [];
  const qp = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(plan && { plan: plan.code }), ...extra })}`;

  return (
    <>
      <AdminHeader section="Billing & Access" title="Feature Entitlements" description="Manage which features are available in each plan. Set access levels and limits for the selected plan." />
      <section className={s.select}>
        <form>
          <label htmlFor="plan">Select Plan to Configure</label>
          <AutoSubmitSelect id="plan" name="plan" defaultValue={plan?.code ?? ''}>
            {planList.length === 0 && <option value="">No plans yet</option>}
            {planList.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.status.toLowerCase()})
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
            <b>{plan ? plan.name : 'No plans available'}</b>
            <p>{plan ? (plan.description ?? 'Entitlements for this plan are shown below.') : <Link href="/admin/plans/new">Create a plan first.</Link>}</p>
          </div>
        </div>
      </section>
      <div className={s.layout}>
        <aside className={s.modules}>
          <form>
            {plan && <input type="hidden" name="plan" value={plan.code} />}
            {only && <input type="hidden" name="module" value={only} />}
            <input name="q" defaultValue={q} placeholder="Search features..." aria-label="Search features" className={s.search} />
          </form>
          <Link href={qp({})} className={!only ? s.on : undefined}>
            <Layers size={18} /> All Features
          </Link>
          {modules.map((m) => (
            <Link key={m} href={qp({ module: m })} className={only === m ? s.on : undefined}>
              {m.replace(/_/g, ' ')}
            </Link>
          ))}
        </aside>
        <section className={s.matrix}>
          <h2>Feature Entitlements</h2>
          <p>Access and limits for each feature in the selected plan. Changes apply to new usage checks immediately.</p>
          {plan ? <EntitlementMatrix key={`${plan.code}:${only ?? ''}:${q ?? ''}`} planCode={plan.code} rows={rows} /> : <p className={s.muted}>Select a plan.</p>}
          <ul className={s.notes}>
            <Info size={18} />
            <li>Usage limits apply per billing period; leave a limit blank for unlimited.</li>
            <li>Plan access is separate from Module Controls (global availability) and Feature Flags (rollouts).</li>
          </ul>
        </section>
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        <Panel title="Workspace Overrides" description="Grant or restrict a feature for one workspace, with a reason. Overrides win over the plan while active." bodyless>
          <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
            <OverrideForm features={all.map((f) => ({ key: f.key, name: f.name }))} workspaces={(workspaces ?? []).map((w) => ({ id: w.id, name: w.name }))} />
          </div>
          <DataTable
            columns={['Workspace', 'Feature', 'Access', 'Limit', 'Reason', 'Active', 'By']}
            rows={(overrides ?? []).map((o) => [
              o.workspace.name,
              o.feature.name,
              o.enabled ? 'Enabled' : 'Disabled',
              o.feature.valueType === 'LIMIT' ? (o.limitNumeric ? Number(o.limitNumeric).toLocaleString('en-US') : 'Unlimited') : '—',
              o.reason,
              `${formatDate(o.startsAt)} – ${o.endsAt ? formatDate(o.endsAt) : 'no end'}`,
              o.creator.displayName ?? o.creator.email,
            ])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>No overrides.</p>}
          />
        </Panel>

        <Panel title="Feature Registry" description="Features that plans and overrides can grant. Keys are referenced by the product code; add new keys only when the product checks them." bodyless>
          <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
            <ApiForm path="/admin/features" submitLabel="Register Feature" resetOnSuccess successMessage="Feature registered.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <Field label="Key" htmlFor="ft-key">
                  <Input id="ft-key" name="key" required maxLength={100} placeholder="e.g. limit.reports" />
                </Field>
                <Field label="Name" htmlFor="ft-name">
                  <Input id="ft-name" name="name" required maxLength={120} />
                </Field>
                <Field label="Module" htmlFor="ft-mod">
                  <Input id="ft-mod" name="moduleKey" data-type="nullable" maxLength={60} placeholder="e.g. reports" />
                </Field>
                <Field label="Type" htmlFor="ft-type">
                  <Select id="ft-type" name="valueType" defaultValue="BOOLEAN">
                    <option value="BOOLEAN">Access (on/off)</option>
                    <option value="LIMIT">Usage limit</option>
                    <option value="CONFIG">Configuration</option>
                  </Select>
                </Field>
              </div>
              <Field label="Description" htmlFor="ft-desc">
                <Input id="ft-desc" name="description" data-type="nullable" maxLength={500} />
              </Field>
            </ApiForm>
          </div>
          <DataTable
            columns={['Key', 'Name', 'Module', 'Type']}
            rows={all.map((f) => [<code key="k">{f.key}</code>, f.name, f.moduleKey ?? '—', f.valueType])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>No features registered.</p>}
          />
        </Panel>
      </div>
    </>
  );
}
