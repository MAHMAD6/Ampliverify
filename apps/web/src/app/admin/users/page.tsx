import Link from 'next/link';
import { Mail, UserX, Users, UserCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, date, dateTime, loadUsers, matchesQ } from '@/lib/admin-data';
import { listSessions } from '@/lib/auth-sessions';

export const metadata = { title: 'All Users' };

/**
 * All Users (chat design 2026-10-06). Live from `GET /admin/users` (global
 * `user.read`); last activity from the auth server's sessions. People join
 * by signing up or through a workspace owner's invitation.
 */
export default async function AllUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const [users, invitations] = await Promise.all([loadUsers(), adminGet<{ status: string; expiresAt: string }[]>('/admin/invitations?status=PENDING')]);
  const lastSeen = new Map<string, Date>();
  if (users) for (const x of await listSessions({ activeOnly: false, sinceDays: 365 })) if (!lastSeen.has(x.email.toLowerCase())) lastSeen.set(x.email.toLowerCase(), x.updatedAt);
  const rows = (users ?? []).filter((u) => matchesQ(q, u.email, u.displayName) && (!status || u.status === status.toUpperCase()));
  return (
    <AdminList
      section="User Management"
      title="All Users"
      description="View and manage all users, their roles, access levels, and account status."
      actions={
        <ButtonLink href="/admin/security?tab=invitations" variant="outline" icon={<Mail size={18} />}>
          View Invitations
        </ButtonLink>
      }
      metrics={[
        { label: 'Total Users', icon: <Users size={26} />, tone: 'green', value: users?.length, note: users ? undefined : 'No users loaded.' },
        { label: 'Active Users', icon: <UserCheck size={26} />, tone: 'blue', value: users?.filter((u) => u.status === 'ACTIVE').length, note: users ? undefined : 'No users loaded.' },
        { label: 'Pending Invitations', icon: <Mail size={26} />, tone: 'purple', value: invitations ? invitations.filter((i) => new Date(i.expiresAt) > new Date()).length : undefined },
        { label: 'Suspended Users', icon: <UserX size={26} />, tone: 'red', value: users?.filter((u) => u.status === 'SUSPENDED').length, note: users ? undefined : 'No users loaded.' },
      ]}
      basePath="/admin/users"
      search="Search users by name or email..."
      liveFilters={{ q }}
      selects={[{ name: 'status', value: status, options: ['All Statuses', ['active', 'Active'], ['suspended', 'Suspended'], ['disabled', 'Disabled']] }]}
      columns={['Name', 'Email', 'Status', 'Joined', 'Last Active', 'Actions']}
      rows={rows.map((u) => [
        <b key="n">{u.displayName ?? '—'}</b>,
        u.email,
        <StatusPill key="s" tone={u.status === 'ACTIVE' ? 'green' : u.status === 'SUSPENDED' ? 'red' : 'slate'}>
          {u.status.charAt(0) + u.status.slice(1).toLowerCase()}
        </StatusPill>,
        date(u.createdAt),
        lastSeen.has(u.email.toLowerCase()) ? dateTime(lastSeen.get(u.email.toLowerCase())!.toISOString()) : '—',
        <Link key="a" href={`/admin/users/${u.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          View
        </Link>,
      ])}
      empty={{
        icon: <Users size={40} />,
        title: users && users.length ? 'No users match your filters' : 'No users yet',
        text: users ? 'Users appear here when they sign up.' : 'User data will appear here once it can be loaded with your admin permissions.',
      }}
    />
  );
}
