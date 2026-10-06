import { Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { loadAssignments, loadRoles, matchesQ } from '@/lib/admin-data';

export const metadata = { title: 'Roles & Permissions' };

/** Roles & Permissions (chat design 2026-10-06). Live from `GET /admin/roles` and active assignments. Role creation needs the create form (API exists, UI pending sign-in). */
export default async function RolesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'system', q } = await searchParams;
  const [roles, assignments] = await Promise.all([loadRoles(), loadAssignments()]);
  const system = roles?.filter((r) => r.isSystem) ?? [];
  const custom = roles?.filter((r) => !r.isSystem) ?? [];
  const list = (tab === 'custom' ? custom : system).filter((r) => matchesQ(q, r.name, r.key, r.description));
  const users = (id: string) => (assignments ? new Set(assignments.filter((a) => a.role.id === id).map((a) => a.user.id)).size : '—');
  return (
    <AdminList
      section="User Management"
      title="Roles & Permissions"
      description="Manage system and custom roles, and the permissions each role grants."
      actions={
        <Button icon={<Plus size={18} />} disabled title="Custom roles can be created once signed-in admin actions are available.">
          Create Custom Role
        </Button>
      }
      metrics={[
        { label: 'System Roles', icon: <Layers size={30} />, tone: 'blue', value: roles ? system.length : undefined, note: 'Built-in roles (managed by system)' },
        { label: 'Custom Roles', icon: <Layers size={30} />, tone: 'purple', value: roles ? custom.length : undefined, note: 'Created and managed by admins' },
      ]}
      tabs={[
        { key: 'system', label: 'System Roles' },
        { key: 'custom', label: 'Custom Roles' },
      ]}
      activeTab={tab}
      basePath="/admin/roles"
      search="Search roles by name or description..."
      liveFilters={{ q }}
      columns={['Role Name', 'Description', 'Permissions', 'Users', 'Type']}
      rows={list.map((r) => [
        <span key="n">
          <b>{r.name}</b>
          <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{r.key}</small>
        </span>,
        r.description ?? '—',
        r.permissions.length ? r.permissions.length : 'Configured per assignment',
        users(r.id),
        <StatusPill key="t" tone={r.isSystem ? 'blue' : 'green'}>
          {r.isSystem ? 'System' : 'Custom'}
        </StatusPill>,
      ])}
      empty={{
        icon: <Layers size={40} />,
        title: tab === 'custom' && roles ? 'No custom roles yet' : 'No roles to display',
        text: roles ? 'Custom roles bundle only permissions you already hold.' : 'System roles will appear here when loaded with your admin permissions.',
      }}
    />
  );
}
