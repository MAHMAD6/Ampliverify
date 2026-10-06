import Link from 'next/link';
import { Layers, User, UserX, Users } from 'lucide-react';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { AddMenu } from '@/components/admin/AddMenu';
import { date, loadAssignments, loadUsers, matchesQ, scopeLabel, userLabel } from '@/lib/admin-data';

export const metadata = { title: 'Access Assignments' };

/**
 * Access Assignments (chat design 2026-10-06). Live from
 * `GET /admin/access-assignments`. Module-level access is governed by plan
 * entitlements and Module Controls, not per-user grants, so the Module Access
 * tab explains that instead of inventing per-user module data.
 */
export default async function AccessPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; scope?: string }> }) {
  const { tab = 'roles', q, scope } = await searchParams;
  const [assignments, users] = await Promise.all([loadAssignments(), loadUsers()]);
  const assigned = new Set((assignments ?? []).map((a) => a.user.id));
  const rows = tab === 'roles' ? (assignments ?? []).filter((a) => matchesQ(q, a.user.email, a.user.displayName, a.role.name) && (!scope || scopeLabel(a) === scope)) : [];
  return (
    <AdminList
      section="User Management"
      title="Access Assignments"
      description="Assign roles to users at platform, organization, workspace or project scope."
      actions={
        <AddMenu
          label="Create Assignment"
          items={[
            { title: 'Assign Role', text: 'Grant a role at a scope', icon: <User size={20} />, disabledReason: 'Available once signed-in admin actions are wired (API ready).' },
            { title: 'Assign Module Access', text: 'Per-user module access', icon: <Layers size={20} />, disabledReason: 'Module access follows plan entitlements.' },
          ]}
        />
      }
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
        scopeLabel(a),
        <StatusPill key="s" tone={a.user.status === 'ACTIVE' ? 'green' : 'slate'}>
          {a.user.status === 'ACTIVE' ? 'Active' : a.user.status}
        </StatusPill>,
        date(a.createdAt),
        <Link key="v" href={`/admin/admins/${a.user.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          View
        </Link>,
      ])}
      empty={
        tab === 'modules'
          ? { icon: <Layers size={40} />, title: 'Module access follows plans', text: 'Module availability is set in Module Controls and plan access in Feature Entitlements. Per-user module grants are not used.' }
          : { icon: <Users size={40} />, title: assignments?.length ? 'No assignments match your filters' : 'No access assignments yet', text: 'Assign roles to users to give them the appropriate permissions in AmpliVerify.' }
      }
    />
  );
}
