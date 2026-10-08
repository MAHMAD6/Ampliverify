import { Layers } from 'lucide-react';
import { Field, Input, Panel } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { loadAssignments, loadRoles, matchesQ } from '@/lib/admin-data';
import { loadAdminMe } from '@/lib/auth-sessions';

export const metadata = { title: 'Roles & Permissions' };

/**
 * Roles & Permissions (chat design 2026-10-06). Live from `GET /admin/roles`
 * and active assignments. Custom roles can bundle only permissions the
 * creator already holds (enforced by the API).
 */
export default async function RolesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'system', q } = await searchParams;
  const [roles, assignments, me] = await Promise.all([loadRoles(), loadAssignments(), loadAdminMe()]);
  const grantable = me?.permissions ?? [];
  const system = roles?.filter((r) => r.isSystem) ?? [];
  const custom = roles?.filter((r) => !r.isSystem) ?? [];
  const list = (tab === 'custom' ? custom : system).filter((r) => matchesQ(q, r.name, r.key, r.description));
  const users = (id: string) => (assignments ? new Set(assignments.filter((a) => a.role.id === id).map((a) => a.user.id)).size : '—');
  return (
    <AdminList
      section="User Management"
      title="Roles & Permissions"
      description="Manage system and custom roles, and the permissions each role grants."
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
        <details key="p">
          <summary style={{ cursor: 'pointer' }}>{r.permissions.length} permissions</summary>
          <small style={{ display: 'block', maxWidth: 360, color: 'var(--muted)' }}>{r.permissions.map((p) => p.permission.key).join(', ') || '—'}</small>
        </details>,
        users(r.id),
        <StatusPill key="t" tone={r.isSystem ? 'blue' : 'green'}>
          {r.isSystem ? 'System' : 'Custom'}
        </StatusPill>,
      ])}
      children={
        roles && grantable.length > 0 && me?.permissions.includes('admin.role.manage') ? (
          <Panel title="Create Custom Role" description="Bundle permissions you already hold. System roles cannot be changed.">
            <ApiForm path="/admin/roles" submitLabel="Create Custom Role" resetOnSuccess successMessage="Role created.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <Field label="Key" htmlFor="r-key" hint="e.g. CONTENT_EDITOR">
                  <Input id="r-key" name="key" required maxLength={120} pattern="[A-Za-z0-9_]+" />
                </Field>
                <Field label="Name" htmlFor="r-name">
                  <Input id="r-name" name="name" required maxLength={160} />
                </Field>
                <Field label="Description" htmlFor="r-desc">
                  <Input id="r-desc" name="description" data-type="optional" maxLength={500} />
                </Field>
              </div>
              <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                <legend style={{ fontSize: 14, fontWeight: 600 }}>Permissions</legend>
                {grantable.map((p) => (
                  <label key={p} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                    <input type="checkbox" name="permissionKeys" data-type="array" value={p} /> <code>{p}</code>
                  </label>
                ))}
              </fieldset>
            </ApiForm>
          </Panel>
        ) : undefined
      }
      empty={{
        icon: <Layers size={40} />,
        title: tab === 'custom' && roles ? 'No custom roles yet' : 'No roles to display',
        text: roles ? 'Custom roles bundle only permissions you already hold.' : 'System roles will appear here when loaded with your admin permissions.',
      }}
    />
  );
}
