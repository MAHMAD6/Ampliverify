import { ShieldCheck, Users } from 'lucide-react';
import { Badge, DataTable, Field, FormGrid, Input, Panel, Select, Stack } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { InviteMemberForm, MemberRoleSelect } from '@/components/app/settings/MemberControls';
import { apiGet } from '@/lib/api';
import { getAppContext } from '@/lib/project';
import type { Member, WorkspaceView } from '@/lib/app-types';
import { formatDate, humanize } from '@/lib/format';

export const metadata = { title: 'Workspace · Settings' };

type Invitation = { id: string; email: string; roleKey: string; status: string; expiresAt: string; createdAt: string; inviter: { displayName: string | null; email: string } };

const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
const LANGS: [string, string][] = [
  ['en', 'English'],
  ['de', 'German'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['nl', 'Dutch'],
  ['ar', 'Arabic'],
  ['ur', 'Urdu'],
  ['ja', 'Japanese'],
];

/** Workspace settings (user-settings/Workspace.png): details, members, invitations and roles. */
export default async function WorkspaceSettingsPage() {
  const { workspaceId, me } = await getAppContext();
  if (!workspaceId) {
    return <StateView kind="empty" icon={<Users size={28} />} title="No workspace yet" description="Create a project to set up your workspace." />;
  }
  const [wsRes, membersRes, invitesRes] = await Promise.all([
    apiGet<WorkspaceView>(`/user/workspaces/${workspaceId}`, { auth: true }),
    apiGet<Member[]>(`/user/workspaces/${workspaceId}/members`, { auth: true }),
    apiGet<Invitation[]>(`/user/workspaces/${workspaceId}/invitations`, { auth: true }),
  ]);
  const ws = wsRes.ok ? wsRes.data : null;
  const members = membersRes.ok ? membersRes.data : [];
  const invites = invitesRes.ok ? invitesRes.data.filter((i) => i.status === 'PENDING') : [];
  const canEdit = !!ws?.permissions.update;
  const canManage = !!ws?.permissions.manageMembers;

  return (
    <>
      <h2>Workspace</h2>
      <p>Manage workspace details, members, and access. Team features may depend on your plan.</p>
      <Stack>
        <Panel title="Workspace Details" description={ws?.organization ? `Organization: ${ws.organization.name}` : 'Details of your current workspace.'}>
          {canEdit ? (
            <ApiForm method="PATCH" path={`/user/workspaces/${workspaceId}`} submitLabel="Save Workspace">
              <FormGrid>
                <Field label="Workspace Name" htmlFor="w-name">
                  <Input id="w-name" name="name" defaultValue={ws?.name} required maxLength={120} />
                </Field>
                <Field label="Workspace ID" htmlFor="w-id">
                  <Input id="w-id" value={ws?.id ?? ''} readOnly disabled />
                </Field>
                <Field label="Default Timezone" htmlFor="w-tz">
                  <Select id="w-tz" name="timezone" defaultValue={ws?.timezone ?? 'UTC'}>
                    {[...new Set([ws?.timezone ?? 'UTC', ...TIMEZONES])].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Default Language" htmlFor="w-lang">
                  <Select id="w-lang" name="language" defaultValue={ws?.language ?? 'en'}>
                    {LANGS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FormGrid>
            </ApiForm>
          ) : (
            <FormGrid>
              <Field label="Workspace Name" htmlFor="w-name">
                <Input id="w-name" value={ws?.name ?? '—'} readOnly disabled />
              </Field>
              <Field label="Default Timezone" htmlFor="w-tz">
                <Input id="w-tz" value={ws?.timezone ?? '—'} readOnly disabled />
              </Field>
            </FormGrid>
          )}
        </Panel>

        <Panel title={`Members & Access (${members.length})`} description="Owners manage projects, billing and members; members can view everything." bodyless>
          {canManage && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <InviteMemberForm workspaceId={workspaceId} />
            </div>
          )}
          <DataTable
            columns={['Member', 'Role', 'Joined', 'Actions']}
            rows={members.map((m) => [
              <div key="m">
                <b>{m.displayName ?? m.email}</b>
                {m.userId === me?.id && <Badge tone="blue">You</Badge>}
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.email}</div>
              </div>,
              canManage ? <MemberRoleSelect key="r" workspaceId={workspaceId} userId={m.userId} role={m.role} /> : humanize(m.role),
              formatDate(m.joinedAt),
              (canManage || m.userId === me?.id) && (
                <ActionButton key="a" size="sm" variant="ghost" method="DELETE" path={`/user/workspaces/${workspaceId}/members/${m.userId}`} confirm={m.userId === me?.id ? 'Leave this workspace?' : `Remove ${m.email} from the workspace?`} redirectTo={m.userId === me?.id ? '/app/dashboard' : undefined}>
                  {m.userId === me?.id ? 'Leave' : 'Remove'}
                </ActionButton>
              ),
            ])}
            empty={<StateView kind="empty" compact icon={<Users size={26} />} title="No workspace members to display" description="Invite teammates to collaborate." />}
          />
        </Panel>

        {canManage && invites.length > 0 && (
          <Panel title="Pending Invitations" bodyless>
            <DataTable
              columns={['Email', 'Role', 'Invited by', 'Expires', 'Actions']}
              rows={invites.map((i) => [
                i.email,
                humanize(i.roleKey),
                i.inviter.displayName ?? i.inviter.email,
                formatDate(i.expiresAt),
                <ActionButton key="r" size="sm" variant="ghost" path={`/user/invitations/${i.id}/revoke`}>
                  Revoke
                </ActionButton>,
              ])}
            />
          </Panel>
        )}

        <Panel title="Roles & Permissions" description="What each workspace role can do.">
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10, fontSize: 14 }}>
            <li style={{ display: 'flex', gap: 10 }}>
              <ShieldCheck size={18} color="var(--blue)" /> <span><b>Owner</b> — create and manage projects, run audits and AI checks, manage billing, integrations and members.</span>
            </li>
            <li style={{ display: 'flex', gap: 10 }}>
              <ShieldCheck size={18} color="var(--muted)" /> <span><b>Member</b> — view projects, audits, keywords, AI search results, content and reports.</span>
            </li>
          </ul>
        </Panel>
      </Stack>
    </>
  );
}
