import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Badge, DataTable, Field, Input, Notice, Panel, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { AdminHeader } from '@/components/admin/AdminParts';
import { Markdown } from '@/components/public/Markdown';
import { adminGet, dateTime } from '@/lib/admin-data';

export const metadata = { title: 'Public Pages · Admin' };

type Content = { title: string; description: string | null; body: string };
type Row = {
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'PUBLISHED_WITH_CHANGES';
  draft: (Content & { updatedAt: string }) | null;
  published: (Content & { publishedAt: string }) | null;
  createdAt: string;
};

const STATUS = {
  DRAFT: <Badge>Draft</Badge>,
  PUBLISHED: <Badge tone="green">Published</Badge>,
  PUBLISHED_WITH_CHANGES: <Badge tone="amber">Unpublished changes</Badge>,
};

/** Public Pages CMS (V2 guide §1): draft, preview, publish, unpublish and delete simple pages served at /pages/[address]. */
export default async function AdminPublicPages({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const rows = await adminGet<Row[]>('/admin/public-pages');
  const active = rows?.find((r) => r.slug === edit);
  const current = active ? (active.draft ?? active.published) : null;
  return (
    <>
      <AdminHeader section="Content Management" title="Public Pages" description="Simple Markdown pages on the public site, such as announcements or partner pages. Changes stay in draft until published." />
      {!rows ? (
        <Panel>
          <StateView kind="error" icon={<FileText size={36} />} title="Pages could not be loaded with your permissions." description="Managing pages needs the cms.manage permission." />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Pages" bodyless>
            <DataTable
              columns={['Page', 'Address', 'Status', 'Updated', '']}
              rows={rows.map((r) => [
                <Link key="t" href={`/admin/public-pages?edit=${r.slug}`} style={{ fontWeight: 600 }}>
                  {(r.draft ?? r.published)?.title ?? r.slug}
                </Link>,
                <code key="a" style={{ overflowWrap: 'anywhere' }}>
                  /pages/{r.slug}
                </code>,
                <span key="s">{STATUS[r.status]}</span>,
                dateTime(r.draft?.updatedAt ?? r.published?.publishedAt ?? r.createdAt),
                r.published ? (
                  <Link key="v" href={`/pages/${r.slug}`} target="_blank">
                    View
                  </Link>
                ) : (
                  ''
                ),
              ])}
              empty="No pages yet. Create the first one below."
            />
          </Panel>

          {active && current ? (
            <>
              <Panel title={`Edit: ${current.title}`} description={active.published ? `Live since ${dateTime(active.published.publishedAt)}.` : 'Not published yet.'} actions={<Link href="/admin/public-pages">Close</Link>}>
                {active.draft && active.published && (
                  <div style={{ marginBottom: 12 }}>
                    <Notice tone="amber" title="This page has unpublished changes.">
                      The live page still shows the last published version.
                    </Notice>
                  </div>
                )}
                <ApiForm key={active.slug} method="PUT" path={`/admin/public-pages/${active.slug}`} submitLabel="Save draft" successMessage="Draft saved.">
                  <Field label="Title" htmlFor="pp-title">
                    <Input id="pp-title" name="title" required minLength={3} maxLength={160} defaultValue={current.title} />
                  </Field>
                  <Field label="Summary (search engines and the page header)" htmlFor="pp-desc">
                    <Input id="pp-desc" name="description" maxLength={300} defaultValue={current.description ?? ''} />
                  </Field>
                  <Field label="Content (Markdown)" htmlFor="pp-body">
                    <Textarea id="pp-body" name="body" rows={18} required minLength={20} maxLength={100000} defaultValue={current.body} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
                  </Field>
                </ApiForm>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  {active.draft && (
                    <ActionButton path={`/admin/public-pages/${active.slug}/publish`} successMessage="Published." confirm="Publish the saved draft to the live site?">
                      Publish draft
                    </ActionButton>
                  )}
                  {active.published && (
                    <ActionButton path={`/admin/public-pages/${active.slug}/unpublish`} variant="outline" successMessage="Unpublished." confirm="Take this page offline? Its text is kept as a draft.">
                      Unpublish
                    </ActionButton>
                  )}
                  {!active.published && (
                    <ActionButton method="DELETE" path={`/admin/public-pages/${active.slug}`} variant="outline" successMessage="Page deleted." confirm="Delete this page permanently?" redirectTo="/admin/public-pages">
                      Delete
                    </ActionButton>
                  )}
                </div>
              </Panel>
              <Panel title="Preview of the saved version" description="Save the draft to refresh the preview. Raw HTML is not rendered.">
                <h2 style={{ marginTop: 0 }}>{current.title}</h2>
                {current.description && <p style={{ color: 'var(--muted)' }}>{current.description}</p>}
                <Markdown source={current.body} />
              </Panel>
            </>
          ) : (
            <Panel title="New page" description="Pages are created as drafts.">
              <ApiForm method="POST" path="/admin/public-pages" submitLabel="Create draft" successMessage="Draft created." redirectTo={(d) => `/admin/public-pages?edit=${(d as { slug: string }).slug}`}>
                <Field label="Address" htmlFor="np-slug" hint="Lowercase letters, numbers and hyphens. The page will live at /pages/[address].">
                  <Input id="np-slug" name="slug" required minLength={3} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="partner-program" />
                </Field>
                <Field label="Title" htmlFor="np-title">
                  <Input id="np-title" name="title" required minLength={3} maxLength={160} />
                </Field>
                <Field label="Summary" htmlFor="np-desc">
                  <Input id="np-desc" name="description" maxLength={300} />
                </Field>
                <Field label="Content (Markdown)" htmlFor="np-body">
                  <Textarea id="np-body" name="body" rows={10} required minLength={20} maxLength={100000} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
                </Field>
              </ApiForm>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
