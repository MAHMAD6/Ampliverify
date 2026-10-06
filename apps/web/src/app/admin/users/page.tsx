import Link from 'next/link';
import { Mail, UserPlus, UserX, Users, UserCheck } from 'lucide-react';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { AddMenu } from '@/components/admin/AddMenu';
import { date, loadUsers, matchesQ } from '@/lib/admin-data';

export const metadata = { title: 'All Users' };

const ADD = [
  { title: 'Create User', text: 'Create a new user account', icon: <UserPlus size={20} />, disabledReason: 'Accounts are created through sign-up (Better Auth).' },
  { title: 'Send Invitation', text: 'Invite a user to join', icon: <Mail size={20} />, disabledReason: 'Invitations are not available yet.' },
];

/** All Users (chat design 2026-10-06). Live from `GET /admin/users` (global `user.read`). Plan and last-active need APIs that don't exist yet. */
export default async function AllUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const users = await loadUsers();
  const rows = (users ?? []).filter((u) => matchesQ(q, u.email, u.displayName) && (!status || u.status === status.toUpperCase()));
  return (
    <AdminList
      section="User Management"
      title="All Users"
      description="View and manage all users, their roles, access levels, and account status."
      actions={<AddMenu label="Add User" items={ADD} />}
      metrics={[
        { label: 'Total Users', icon: <Users size={26} />, tone: 'green', value: users?.length, note: users ? undefined : 'No users loaded.' },
        { label: 'Active Users', icon: <UserCheck size={26} />, tone: 'blue', value: users?.filter((u) => u.status === 'ACTIVE').length, note: users ? undefined : 'No users loaded.' },
        { label: 'Pending Invitations', icon: <Mail size={26} />, tone: 'purple', note: 'No invitations yet.' },
        { label: 'Suspended Users', icon: <UserX size={26} />, tone: 'red', value: users?.filter((u) => u.status === 'SUSPENDED').length, note: users ? undefined : 'No users loaded.' },
      ]}
      basePath="/admin/users"
      search="Search users by name or email..."
      liveFilters={{ q }}
      selects={[{ name: 'status', value: status, options: ['All Statuses', ['active', 'Active'], ['suspended', 'Suspended'], ['disabled', 'Disabled']] }]}
      columns={['Name', 'Email', 'Status', 'Joined', 'Actions']}
      rows={rows.map((u) => [
        <b key="n">{u.displayName ?? '—'}</b>,
        u.email,
        <StatusPill key="s" tone={u.status === 'ACTIVE' ? 'green' : 'slate'}>
          {u.status.charAt(0) + u.status.slice(1).toLowerCase()}
        </StatusPill>,
        date(u.createdAt),
        <Link key="a" href={`/admin/admins/${u.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
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
