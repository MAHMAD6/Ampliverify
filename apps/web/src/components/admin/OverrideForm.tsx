'use client';

import { useState } from 'react';
import { Field, Input, Select } from '../ui';
import { ApiForm } from '../ui/actions';

/** Adds a workspace entitlement override (POST /admin/workspaces/:id/entitlement-overrides). */
export function OverrideForm({ features, workspaces }: { features: { key: string; name: string }[]; workspaces: { id: string; name: string }[] }) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '');
  if (!workspaces.length || !features.length) return <p style={{ color: 'var(--muted)', fontSize: 14 }}>Overrides need at least one workspace and one registered feature.</p>;
  return (
    <ApiForm path={`/admin/workspaces/${workspaceId}/entitlement-overrides`} submitLabel="Add Override" resetOnSuccess successMessage="Override added.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Field label="Workspace" htmlFor="ov-ws">
          {/* Not submitted: the workspace is part of the API path. */}
          <Select id="ov-ws" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Feature" htmlFor="ov-f">
          <Select id="ov-f" name="featureKey" required>
            {features.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Access" htmlFor="ov-e">
          <Select id="ov-e" name="enabled" data-type="bool" defaultValue="true">
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </Select>
        </Field>
        <Field label="Limit (limit features)" htmlFor="ov-l">
          <Input id="ov-l" name="limit" type="number" data-type="number" min={0} placeholder="Unlimited" />
        </Field>
        <Field label="Ends (optional)" htmlFor="ov-d">
          <Input id="ov-d" name="endsAt" type="date" data-type="date" />
        </Field>
      </div>
      <Field label="Reason" htmlFor="ov-r">
        <Input id="ov-r" name="reason" required minLength={3} maxLength={500} placeholder="e.g. Pilot agreement, ticket #1234" />
      </Field>
    </ApiForm>
  );
}
