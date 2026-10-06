import { ShieldCheck, Users } from 'lucide-react';
import { Button, DataTable, Field, FormGrid, Input, Panel, Stack } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Workspace · Settings' };

type Workspace = { id: string; name: string; organizationId: string };

/**
 * Workspace settings (user-settings/Workspace.png). Values come only from the
 * workspace API; members and roles stay empty until the membership endpoints
 * exist, and team actions depend on plan entitlements. Workspaces have no
 * timezone or language fields in the schema yet (see docs/INPUTS.md).
 */
export default async function WorkspaceSettingsPage() {
  const [{ selectedProject }, workspaces] = await Promise.all([getAppContext(), apiGet<Workspace[]>('/user/workspaces', { auth: true })]);
  const list = workspaces.ok ? workspaces.data : [];
  const workspace = list.find((w) => w.id === selectedProject?.workspaceId) ?? list[0] ?? null;

  return (
    <>
      <h2>Workspace</h2>
      <p>Manage workspace details, members, and access. Team features may depend on your plan.</p>
      <Stack>
        <Panel
          title="Workspace Details"
          description={workspace ? 'Details of your current workspace.' : 'Workspace information will appear here when it is available.'}
          actions={
            <Button variant="muted" disabled>
              Edit Workspace
            </Button>
          }
        >
          <FormGrid>
            <Field label="Workspace Name" htmlFor="w-name">
              <Input id="w-name" value={workspace?.name ?? '—'} readOnly disabled />
            </Field>
            <Field label="Workspace ID" htmlFor="w-id">
              <Input id="w-id" value={workspace?.id ?? '—'} readOnly disabled />
            </Field>
            <Field label="Default Timezone" htmlFor="w-tz">
              <Input id="w-tz" value="—" readOnly disabled />
            </Field>
            <Field label="Default Language" htmlFor="w-lang">
              <Input id="w-lang" value="—" readOnly disabled />
            </Field>
          </FormGrid>
        </Panel>

        <Panel
          title="Members & Access"
          description="Invite teammates and manage access when workspace collaboration is enabled."
          bodyless
          actions={
            <Button variant="muted" disabled>
              Invite Member
            </Button>
          }
        >
          <DataTable
            columns={['Member', 'Role', 'Status', 'Actions']}
            empty={<StateView kind="empty" compact icon={<Users size={26} />} title="No workspace members to display" description="Member and role data will appear when collaboration is configured." />}
          />
        </Panel>

        <Panel title="Roles & Permissions" description="Workspace roles and permission controls will be shown when team access is available.">
          <p style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface-alt)', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: 'var(--text)' }}>
            <ShieldCheck size={18} color="var(--muted)" /> No role configuration is available yet.
          </p>
        </Panel>
      </Stack>
    </>
  );
}
