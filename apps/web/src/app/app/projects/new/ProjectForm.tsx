'use client';

import { useActionState } from 'react';
import { Button, Field, Input, Notice, Select } from '@/components/ui';
import { createProject, type CreateProjectState } from './actions';

export function ProjectForm({ workspaces, disabled }: { workspaces: { id: string; name: string }[]; disabled: boolean }) {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(createProject, {});
  return (
    <form action={action}>
      <Field label="Workspace" htmlFor="p-workspace">
        <Select id="p-workspace" name="workspaceId" defaultValue={workspaces[0]?.id ?? ''} disabled={disabled} required>
          {workspaces.length === 0 && <option value="">No workspaces available</option>}
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Project name" htmlFor="p-name" hint="Usually your website or brand name.">
        <Input id="p-name" name="name" maxLength={160} placeholder="e.g. Main website" disabled={disabled} required />
      </Field>
      {state.error && (
        <div style={{ marginBottom: 14 }}>
          <Notice tone="amber">{state.error}</Notice>
        </div>
      )}
      <Button type="submit" disabled={disabled || pending}>
        {pending ? 'Creating…' : 'Create Project'}
      </Button>
    </form>
  );
}
