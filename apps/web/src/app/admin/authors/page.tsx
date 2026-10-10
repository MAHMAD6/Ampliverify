import { DataTable, Field, Input, Panel, Select, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { adminGet, loadUsers } from '@/lib/admin-data';

export const metadata = { title: 'Authors' };

type Author = { id: string; displayName: string; slug: string; bio: string | null; userId: string | null; user: { id: string; email: string } | null; _count: { blogPosts: number } };

/** Author profiles shown on blog posts; optionally linked to a user account. */
export default async function AuthorsPage() {
  const [authors, users] = await Promise.all([adminGet<Author[]>('/admin/authors'), loadUsers()]);
  const userField = (id: string, value?: string | null) => (
    <Field label="Linked account (optional)" htmlFor={id}>
      <Select id={id} name="userId" data-type="nullable" defaultValue={value ?? ''}>
        <option value="">None</option>
        {(users ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName ?? u.email} ({u.email})
          </option>
        ))}
      </Select>
    </Field>
  );
  return (
    <>
      <AdminHeader section="Content Management" title="Authors" description="Manage author profiles and contributions." />
      <div style={{ display: 'grid', gap: 16 }}>
        <Panel title="New Author">
          <ApiForm path="/admin/authors" submitLabel="Add Author" resetOnSuccess successMessage="Author added.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="Display name" htmlFor="a-name">
                <Input id="a-name" name="displayName" required maxLength={120} />
              </Field>
              {userField('a-user')}
            </div>
            <Field label="Bio" htmlFor="a-bio">
              <Textarea id="a-bio" name="bio" data-type="nullable" rows={2} maxLength={2000} />
            </Field>
          </ApiForm>
        </Panel>
        <Panel title={`Authors (${authors?.length ?? 0})`} bodyless>
          <DataTable
            columns={['Author', 'Posts', 'Edit', '']}
            rows={(authors ?? []).map((a) => [
              <span key="n">
                <b>{a.displayName}</b>
                <small style={{ display: 'block', color: 'var(--muted)' }}>{a.user ? a.user.email : 'No linked account'}</small>
              </span>,
              a._count.blogPosts,
              <details key="e">
                <summary style={{ cursor: 'pointer', color: 'var(--blue)' }}>Edit</summary>
                <ApiForm method="PATCH" path={`/admin/authors/${a.id}`} successMessage="Saved.">
                  <Field label="Display name" htmlFor={`an-${a.id}`}>
                    <Input id={`an-${a.id}`} name="displayName" required maxLength={120} defaultValue={a.displayName} />
                  </Field>
                  {userField(`au-${a.id}`, a.userId)}
                  <Field label="Bio" htmlFor={`ab-${a.id}`}>
                    <Textarea id={`ab-${a.id}`} name="bio" data-type="nullable" rows={2} maxLength={2000} defaultValue={a.bio ?? ''} />
                  </Field>
                </ApiForm>
              </details>,
              <ActionButton key="d" size="sm" variant="ghost" method="DELETE" path={`/admin/authors/${a.id}`} confirm={`Delete ${a.displayName}? Their posts keep their content but lose the byline.`}>
                Delete
              </ActionButton>,
            ])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>{authors ? 'No authors yet.' : 'Authors unavailable.'}</p>}
          />
        </Panel>
      </div>
    </>
  );
}
