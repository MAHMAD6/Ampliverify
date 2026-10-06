'use client';

import { useActionState, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Field, Input, Select } from '@/components/ui';
import { PermissionRestricted, StateView } from '@/components/ui/StateView';
import { createProject, type CreateProjectState } from './actions';

/** Create-project form with the approved processing / error / permission states (user-app-batch2a/02). */
export function ProjectForm({ workspaces, disabled }: { workspaces: { id: string; name: string }[]; disabled: boolean }) {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(createProject, {});
  const [dismissed, setDismissed] = useState<CreateProjectState | null>(null);
  const failed = state !== dismissed && (state.error || state.forbidden);

  if (pending) return <StateView kind="processing" compact title="Creating your project…" description="Setting up your project. This may take a few seconds." />;
  if (failed && state.forbidden) return <PermissionRestricted action="create projects in this workspace" />;
  if (failed)
    return (
      <StateView
        kind="error"
        compact
        title="Failed to create project"
        description={state.error}
        action={
          <Button onClick={() => setDismissed(state)} icon={<RotateCcw size={16} />}>
            Try Again
          </Button>
        }
      />
    );

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
      <Button type="submit" disabled={disabled}>
        Create Project
      </Button>
    </form>
  );
}
