'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from '../ui';
import { ApiForm } from '../ui/actions';

type Rule = { scopeType: string; scopeValue: string; percentage: number | null; priority: number };
const SCOPES = [
  ['WORKSPACE', 'Workspace ID'],
  ['ORGANIZATION', 'Organization ID'],
  ['USER', 'User ID'],
  ['PLAN', 'Plan code'],
  ['PERCENTAGE', 'Percentage of workspaces'],
] as const;

/**
 * Flag rollout editor: on/off, description and targeting rules. With rules,
 * an enabled flag applies only to matching audiences (a limited rollout);
 * without rules it applies to everyone. Saved as one audited PATCH.
 */
export function FlagEditor({ id, environment, enabled, description, rules: initial }: { id: string; environment: string; enabled: boolean; description: string; rules: Rule[] }) {
  const [rules, setRules] = useState<Rule[]>(initial);
  const set = (i: number, patch: Partial<Rule>) => setRules((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <ApiForm
      method="PATCH"
      path={`/admin/feature-flags/${id}`}
      submitLabel={environment === 'production' ? 'Apply Production Change' : 'Save Flag'}
      successMessage="Flag saved."
      transform={(v) => ({ enabled: v.enabled === 'true', description: v.description, rules: rules.map((r, i) => ({ ...r, priority: i, percentage: r.scopeType === 'PERCENTAGE' ? (r.percentage ?? 0) : null, scopeValue: r.scopeType === 'PERCENTAGE' ? r.scopeValue || 'workspace' : r.scopeValue })) })}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="State" htmlFor="fl-on">
          <Select id="fl-on" name="enabled" defaultValue={String(enabled)}>
            <option value="true">On</option>
            <option value="false">Off</option>
          </Select>
        </Field>
        <Field label="Description" htmlFor="fl-desc">
          <Textarea id="fl-desc" name="description" rows={2} maxLength={500} defaultValue={description} />
        </Field>
        <div>
          <b style={{ fontSize: 14 }}>Targeting rules</b>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No rules = everyone in {environment}. Rules are checked in order.</p>
          {rules.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(160px, 1.4fr) 110px auto', gap: 8, alignItems: 'end', marginTop: 8 }}>
              <Field label="Audience" htmlFor={`fr-t-${i}`}>
                <Select id={`fr-t-${i}`} value={r.scopeType} onChange={(e) => set(i, { scopeType: e.target.value })}>
                  {SCOPES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Value" htmlFor={`fr-v-${i}`}>
                <Input id={`fr-v-${i}`} value={r.scopeValue} onChange={(e) => set(i, { scopeValue: e.target.value })} disabled={r.scopeType === 'PERCENTAGE'} placeholder={r.scopeType === 'PLAN' ? 'pro' : r.scopeType === 'PERCENTAGE' ? 'workspace' : 'UUID'} required={r.scopeType !== 'PERCENTAGE'} />
              </Field>
              <Field label="%" htmlFor={`fr-p-${i}`}>
                <Input id={`fr-p-${i}`} type="number" min={0} max={100} value={r.percentage ?? ''} onChange={(e) => set(i, { percentage: e.target.value === '' ? null : Number(e.target.value) })} disabled={r.scopeType !== 'PERCENTAGE'} />
              </Field>
              <Button type="button" variant="ghost" aria-label="Remove rule" onClick={() => setRules((x) => x.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => setRules((x) => [...x, { scopeType: 'WORKSPACE', scopeValue: '', percentage: null, priority: x.length }])}>
            Add rule
          </Button>
        </div>
      </div>
    </ApiForm>
  );
}
