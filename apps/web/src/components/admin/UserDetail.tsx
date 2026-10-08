import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock3, Layers, LogOut, Monitor, UserCircle2 } from 'lucide-react';
import { DataTable, Panel } from '../ui';
import { ActionButton } from '../ui/actions';
import { AdminHeader } from './AdminParts';
import { StatusPill } from './AdminList';
import { ReasonAction } from './ReasonAction';
import { RoleAssignForm } from './RoleAssignForm';
import { adminGet, date, dateTime, loadRoles, type AdminWorkspace } from '@/lib/admin-data';
import { describeAgent, listSessions, loadAdminMe } from '@/lib/auth-sessions';
import s from './detail.module.css';

type Detail = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  memberships: { status: string; workspace: { id: string; name: string; organization: { id: string; name: string } } }[];
  roleAssignments: { id: string; scopeType: string; role: { key: string; name: string }; organizationId: string | null; workspaceId: string | null; projectId: string | null; createdAt: string }[];
  activity: { id: string; eventType: string; targetType: string; actorUserId: string | null; reason: string | null; createdAt: string }[];
};

const SCOPE: Record<string, string> = { GLOBAL: 'Platform', ORGANIZATION: 'Organization', WORKSPACE: 'Workspace', PROJECT: 'Project' };

/** One person: profile, workspaces, roles, sign-in sessions and audited activity, with suspend / sign-out / role actions. */
export async function UserDetail({ id, parent }: { id: string; parent: { label: string; href: string } }) {
  const [user, me, roles, workspaces] = await Promise.all([adminGet<Detail>(`/admin/users/${encodeURIComponent(id)}/detail`), loadAdminMe(), loadRoles(), adminGet<AdminWorkspace[]>('/admin/workspaces')]);
  if (!user) notFound();
  const canManage = !!me?.permissions.includes('user.manage');
  const canAssign = !!me?.permissions.includes('admin.access.manage');
  const self = me?.userId === user.id;
  const sessions = me?.permissions.includes('user.read') ? (await listSessions()).filter((x) => x.email.toLowerCase() === user.email.toLowerCase()) : [];
  const wsName = (wid: string | null) => user.memberships.find((m) => m.workspace.id === wid)?.workspace.name ?? (workspaces ?? []).find((w) => w.id === wid)?.name ?? wid;
  const orgName = (oid: string | null) => user.memberships.find((m) => m.workspace.organization.id === oid)?.workspace.organization.name ?? oid;
  const orgs = [...new Map(user.memberships.map((m) => [m.workspace.organization.id, m.workspace.organization.name])).entries()].map(([oid, label]) => ({ id: oid, label }));

  return (
    <>
      <AdminHeader
        section="User Management"
        parent={parent}
        page={user.displayName ?? user.email}
        title="User Detail"
        description="Profile, workspaces, roles, sessions and audited activity for this person."
        actions={
          canManage && !self ? (
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {user.status === 'SUSPENDED' ? <ReasonAction userId={user.id} kind={{ type: 'reactivate' }} label="Reactivate" variant="primary" /> : <ReasonAction userId={user.id} kind={{ type: 'suspend' }} label="Suspend" />}
              <ReasonAction userId={user.id} kind={{ type: 'revoke' }} label="Sign Out Everywhere" variant="ghost" />
            </span>
          ) : undefined
        }
      />
      <section className={s.profile}>
        <span className={s.avatar}>
          <UserCircle2 size={56} />
        </span>
        <dl>
          {[
            ['Name', user.displayName ?? '—'],
            ['Email', user.email],
            ['Status', <StatusPill key="s" tone={user.status === 'ACTIVE' ? 'green' : 'red'}>{user.status.charAt(0) + user.status.slice(1).toLowerCase()}</StatusPill>],
            ['Last Active', sessions[0] ? dateTime(sessions[0].updatedAt.toISOString()) : '—'],
            ['Two-factor', sessions[0] ? (sessions[0].twoFactorEnabled ? 'On' : 'Off') : '—'],
            ['Workspaces', String(user.memberships.length)],
            ['Date Created', date(user.createdAt)],
            ['Last Updated', date(user.updatedAt)],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <Panel title="Workspaces" description="Memberships across organizations." bodyless>
            <DataTable
              columns={['Workspace', 'Organization', 'Membership']}
              rows={user.memberships.map((m) => [m.workspace.name, m.workspace.organization.name, m.status.toLowerCase()])}
              empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>Not a member of any workspace.</p>}
            />
          </Panel>
          <Panel title="Roles & Access" description="Active role assignments." bodyless>
            <DataTable
              columns={['Role', 'Scope', 'Since', '']}
              rows={user.roleAssignments.map((a) => [
                a.role.name,
                `${SCOPE[a.scopeType]}${a.workspaceId ? ` · ${wsName(a.workspaceId)}` : a.organizationId ? ` · ${orgName(a.organizationId)}` : ''}`,
                date(a.createdAt),
                canAssign ? (
                  <ActionButton key="r" size="sm" variant="ghost" path={`/admin/access-assignments/${a.id}/revoke`} body={{}} confirm={`Revoke ${a.role.name} from ${user.email}?`}>
                    Revoke
                  </ActionButton>
                ) : (
                  ''
                ),
              ])}
              empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>No role assignments.</p>}
            />
            {canAssign && roles && (
              <div style={{ padding: 16, borderTop: '1px solid var(--line)' }}>
                <RoleAssignForm fixedUserId={user.id} roles={roles.map((r) => ({ id: r.id, label: r.name }))} workspaces={user.memberships.map((m) => ({ id: m.workspace.id, label: m.workspace.name }))} organizations={orgs} />
              </div>
            )}
          </Panel>
        </div>
        <Panel title="Sign-in Sessions" description="Active sessions from the authentication server." bodyless actions={<Monitor size={18} />}>
          <DataTable
            columns={['Device', 'IP Address', 'Signed In', 'Last Activity', '']}
            rows={sessions.map((x) => [
              describeAgent(x.userAgent),
              x.ipAddress ?? '—',
              dateTime(x.createdAt.toISOString()),
              dateTime(x.updatedAt.toISOString()),
              canManage ? <ReasonAction key="r" userId={user.id} kind={{ type: 'revoke', sessionId: x.id }} label="Revoke" variant="ghost" /> : '',
            ])}
            empty={
              <p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>
                <LogOut size={14} /> Not signed in anywhere.
              </p>
            }
          />
        </Panel>
        <Panel title="Activity" description="Audited actions by or about this person (latest 50)." bodyless actions={<Clock3 size={18} />}>
          <DataTable
            columns={['Event', 'Target', 'By', 'Reason', 'When']}
            rows={user.activity.map((r) => [
              <Link key="e" href={`/admin/activity/${r.id}`} style={{ color: 'var(--blue)' }}>
                <code>{r.eventType}</code>
              </Link>,
              r.targetType,
              r.actorUserId === user.id ? 'This user' : r.actorUserId ? 'Administrator' : 'System',
              r.reason ?? '—',
              dateTime(r.createdAt),
            ])}
            empty={
              <p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>
                <Layers size={14} /> No activity recorded.
              </p>
            }
          />
        </Panel>
      </div>
    </>
  );
}
