import Link from 'next/link';
import { Layers, User, UserX, Users } from 'lucide-react';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { RoleAssignForm } from '@/components/admin/RoleAssignForm';
import { adminGet, date, loadAssignments, loadRoles, loadUsers, matchesQ, scopeLabel, userLabel, type AdminWorkspace } from '@/lib/admin-data';

export const metadata = { title: 'Access Assignments' };

/**
 * Access Assignments (chat design 2026-10-06). Live from
 * `GET /admin/access-assignments`. Module-level access is governed by plan
 * entitlements and Module Controls, not per-user grants, so the Module Access
 * tab explains that instead of inventing per-user module data.
 */
export default async function AccessPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; scope?: string }> }) {
  const { tab = 'roles', q, scope } = await searchParams;
  const [assignments, users, roles, workspaces] = await Promise.all([loadAssignments(), loadUsers(), loadRoles(), adminGet<AdminWorkspace[]>('/admin/workspaces')]);
  const wsName = (id: string | null) => (workspaces ?? []).find((w) => w.id === id)?.name;
  const orgs = [...new Map((workspaces ?? []).map((w) => [w.organization.id, w.organization.name])).entries()].map(([id, label]) => ({ id, label }));
  const assigned = new Set((assignments ?? []).map((a) => a.user.id));
  const rows = tab === 'roles' ? (assignments ?? []).filter((a) => matchesQ(q, a.user.email, a.user.displayName, a.role.name) && (!scope || scopeLabel(a) === scope)) : [];
  return (
    <AdminList
      section="User Management"
      title="Access Assignments"
      description="Assign roles to users at platform, organization, workspace or project scope."
      metrics={[
        { label: 'Total Assignments', icon: <Users size={26} />, tone: 'blue', value: assignments?.length, note: 'Active role assignments' },
        { label: 'Role Assignments', icon: <User size={26} />, tone: 'green', value: assignments ? assigned.size : undefined, note: 'Users with assigned roles' },
        { label: 'Module Access Assignments', icon: <Layers size={26} />, tone: 'purple', note: 'Governed by plan entitlements' },
        { label: 'Unassigned Users', icon: <UserX size={26} />, tone: 'amber', value: users && assignments ? users.filter((u) => !assigned.has(u.id)).length : undefined, note: 'Users without any assignments' },
      ]}
      tabs={[
        { key: 'roles', label: 'User Role Assignments' },
        { key: 'modules', label: 'Module Access' },
      ]}
      activeTab={tab}
      basePath="/admin/access"
      search="Search users by name or email..."
      liveFilters={{ q }}
      selects={[{ label: 'Access Scope', name: 'scope', value: scope, options: ['All', 'Platform', 'Organization', 'Workspace', 'Project'] }]}
      columns={['User', 'Email', 'Role', 'Access Scope', 'Status', 'Assigned', 'Actions']}
      rows={rows.map((a) => [
        <b key="u">{userLabel(a.user)}</b>,
        a.user.email,
        a.role.name,
        `${scopeLabel(a)}${a.workspaceId && wsName(a.workspaceId) ? ` · ${wsName(a.workspaceId)}` : ''}`,
        <StatusPill key="s" tone={a.user.status === 'ACTIVE' ? 'green' : 'slate'}>
          {a.user.status === 'ACTIVE' ? 'Active' : a.user.status}
        </StatusPill>,
        date(a.createdAt),
        <span key="v" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href={`/admin/users/${a.user.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
            View
          </Link>
          <ActionButton size="sm" variant="ghost" path={`/admin/access-assignments/${a.id}/revoke`} body={{}} confirm={`Revoke ${a.role.name} from ${a.user.email}?`}>
            Revoke
          </ActionButton>
        </span>,
      ])}
      children={
        tab === 'roles' && roles && users ? (
          <Panel title="Assign a Role" description="You can only grant roles whose permissions you already hold at that scope; workspace and organization roles need the person to be a member.">
            <RoleAssignForm
              users={users.map((u) => ({ id: u.id, label: `${u.displayName ?? u.email} (${u.email})` }))}
              roles={roles.map((r) => ({ id: r.id, label: r.name }))}
              workspaces={(workspaces ?? []).map((w) => ({ id: w.id, label: `${w.name} · ${w.organization.name}` }))}
              organizations={orgs}
            />
          </Panel>
        ) : undefined
      }
      empty={
        tab === 'modules'
          ? { icon: <Layers size={40} />, title: 'Module access follows plans', text: 'Module availability is set in Module Controls and plan access in Feature Entitlements. Per-user module grants are not used.' }
          : { icon: <Users size={40} />, title: assignments?.length ? 'No assignments match your filters' : 'No access assignments yet', text: 'Assign roles to users to give them the appropriate permissions in AmpliVerify.' }
      }
    />
  );
}
