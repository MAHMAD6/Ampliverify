import { Tags } from 'lucide-react';
import { DataTable, Field, Input, Panel, Select } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { adminGet } from '@/lib/admin-data';

export const metadata = { title: 'Categories & Tags' };

type Category = { id: string; contentType: 'BLOG' | 'GUIDE' | 'HELP'; name: string; slug: string; _count: { blogPosts: number; guides: number; helpArticles: number } };
type Tag = { id: string; name: string; slug: string; _count: { posts: number } };

const TYPE = { BLOG: 'Blog', GUIDE: 'Resources', HELP: 'Help Center' };

/** Categories per content type and blog tags (tags are created from the post editor). A category in use cannot be deleted. */
export default async function CategoriesPage() {
  const [categories, tags] = await Promise.all([adminGet<Category[]>('/admin/categories'), adminGet<Tag[]>('/admin/tags')]);
  const used = (c: Category) => c._count.blogPosts + c._count.guides + c._count.helpArticles;
  return (
    <>
      <AdminHeader section="Content Management" title="Categories & Tags" description="Organize content with categories and tags." />
      <div style={{ display: 'grid', gap: 16 }}>
        <Panel title="New Category">
          <ApiForm path="/admin/categories" submitLabel="Add Category" resetOnSuccess successMessage="Category added.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Content type" htmlFor="c-type">
                <Select id="c-type" name="contentType" defaultValue="BLOG">
                  <option value="BLOG">Blog</option>
                  <option value="GUIDE">Resources</option>
                  <option value="HELP">Help Center</option>
                </Select>
              </Field>
              <Field label="Name" htmlFor="c-name">
                <Input id="c-name" name="name" required maxLength={120} />
              </Field>
              <Field label="Slug (optional)" htmlFor="c-slug">
                <Input id="c-slug" name="slug" data-type="optional" maxLength={120} placeholder="from the name" />
              </Field>
            </div>
          </ApiForm>
        </Panel>
        <Panel title={`Categories (${categories?.length ?? 0})`} bodyless>
          <DataTable
            columns={['Name', 'Type', 'Slug', 'Items', 'Rename', '']}
            rows={(categories ?? []).map((c) => [
              <b key="n">{c.name}</b>,
              TYPE[c.contentType],
              <code key="s">{c.slug}</code>,
              used(c),
              <ApiForm key="r" method="PATCH" path={`/admin/categories/${c.id}`} submitLabel="Rename" successMessage="Saved.">
                <Input name="name" defaultValue={c.name} required maxLength={120} aria-label={`Rename ${c.name}`} />
              </ApiForm>,
              <ActionButton key="d" size="sm" variant="ghost" method="DELETE" path={`/admin/categories/${c.id}`} confirm={`Delete the category “${c.name}”?`} disabled={used(c) > 0} title={used(c) ? 'Move its items to another category first' : undefined}>
                Delete
              </ActionButton>,
            ])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>{categories ? 'No categories yet.' : 'Categories unavailable.'}</p>}
          />
        </Panel>
        <Panel title={`Tags (${tags?.length ?? 0})`} description="Tags are added to blog posts in the post editor." bodyless>
          <DataTable
            columns={['Tag', 'Slug', 'Posts']}
            rows={(tags ?? []).map((t) => [
              <span key="t" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Tags size={14} /> {t.name}
              </span>,
              <code key="s">{t.slug}</code>,
              t._count.posts,
            ])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>No tags yet.</p>}
          />
        </Panel>
      </div>
    </>
  );
}
