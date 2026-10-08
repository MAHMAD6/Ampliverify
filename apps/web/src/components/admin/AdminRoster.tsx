import Link from 'next/link';
import type { ReactNode } from 'react';
import { Globe2, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import { ButtonLink } from '../ui';
import { AdminList, StatusPill } from './AdminList';
import { dateTime, loadAssignments, matchesQ, scopeLabel, userLabel, type AdminAssignment } from '@/lib/admin-data';

/**
 * Admins / Sub-Admins (chat designs 2026-10-06): people holding the given
 * system roles, from active role assignments (`GET /admin/access-assignments`).
 */
export async function AdminRoster({ kind, roleKeys, q, scope, status, emptyIcon }: { kind: 'Admin' | 'Sub-Admin'; roleKeys: string[]; q?: string; scope?: string; status?: string; emptyIcon: ReactNode }) {
  const assignments = await loadAssignments();
  const held = (assignments ?? []).filter((a) => roleKeys.includes(a.role.key));
  const byUser = new Map<string, AdminAssignment[]>();
  for (const a of held) byUser.set(a.user.id, [...(byUser.get(a.user.id) ?? []), a]);
  const people = [...byUser.values()];
  const rows = people.filter(([a]) => matchesQ(q, a.user.email, a.user.displayName) && (!status || a.user.status === status.toUpperCase()) && (!scope || people.length === 0 || byUser.get(a.user.id)!.some((x) => scopeLabel(x) === scope)));
  const plural = `${kind}s`;
  const base = kind === 'Admin' ? '/admin/admins' : '/admin/sub-admins';
  return (
    <AdminList
      section="User Management"
      title={plural}
      description={`Manage ${kind.toLowerCase()} accounts, their roles, permissions, and access assignments.`}
      actions={
        <ButtonLink href="/admin/access" icon={<UserPlus size={18} />}>
          {`Add ${kind}`}
        </ButtonLink>
      }
      metrics={[
        { label: `Total ${plural}`, icon: <Users size={26} />, tone: 'blue', value: assignments ? people.length : undefined, note: assignments && people.length ? undefined : `No ${plural.toLowerCase()} yet` },
        { label: `Active ${plural}`, icon: <UserCheck size={26} />, tone: 'green', value: assignments ? people.filter(([a]) => a.user.status === 'ACTIVE').length : undefined },
        { label: 'Platform-wide', icon: <Globe2 size={26} />, tone: 'amber', value: assignments ? people.filter((list) => list.some((x) => x.scopeType === 'GLOBAL')).length : undefined, note: 'Hold a platform-scope role' },
        { label: `Suspended ${plural}`, icon: <UserX size={26} />, tone: 'red', value: assignments ? people.filter(([a]) => a.user.status === 'SUSPENDED').length : undefined },
      ]}
      basePath={base}
      search="Search by name or email..."
      liveFilters={{ q }}
      selects={[
        { label: 'Access Scope', name: 'scope', value: scope, options: ['All', 'Platform', 'Organization', 'Workspace', 'Project'] },
        { label: 'Status', name: 'status', value: status, options: ['All', ['active', 'Active'], ['suspended', 'Suspended']] },
      ]}
      columns={['Name', 'Email', 'Role', 'Access Scope', 'Permissions', 'Status', 'Assigned', 'Actions']}
      rows={rows.map((list) => {
        const a = list[0];
        return [
          <b key="n">{userLabel(a.user)}</b>,
          a.user.email,
          [...new Set(list.map((x) => x.role.name))].join(', '),
          [...new Set(list.map(scopeLabel))].join(', '),
          'Role-defined',
          <StatusPill key="s" tone={a.user.status === 'ACTIVE' ? 'green' : 'slate'}>
            {a.user.status.charAt(0) + a.user.status.slice(1).toLowerCase()}
          </StatusPill>,
          dateTime(list[list.length - 1].createdAt),
          <Link key="v" href={`/admin/admins/${a.user.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
            View
          </Link>,
        ];
      })}
      empty={{
        icon: emptyIcon,
        title: assignments && people.length ? 'No matches for your filters' : `No ${plural.toLowerCase()} yet`,
        text: kind === 'Sub-Admin' ? 'Sub-admins help manage specific areas of AmpliVerify with assigned roles and permissions.' : 'Administrators appear here once the Admin or Super Admin role is assigned.',
      }}
    />
  );
}
