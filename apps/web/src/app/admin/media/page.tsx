import Link from 'next/link';
import { ImageIcon, Search } from 'lucide-react';
import { EmptyState, Field, Input, Panel } from '@/components/ui';
import { ActionButton, ApiForm, UploadForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { adminGet, dateTime, matchesQ } from '@/lib/admin-data';
import s from '@/components/admin/media.module.css';

export const metadata = { title: 'Media Library' };

type Asset = { id: string; mimeType: string; sizeBytes: string; altText: string | null; createdAt: string; uploader: { displayName: string | null; email: string }; _count: { blogPosts: number } };

const kb = (b: string) => `${Math.max(1, Math.round(Number(b) / 1024)).toLocaleString('en-US')} KB`;

/**
 * Media Library (chat design 2026-10-06). Images are validated by content
 * (PNG, JPEG, GIF, WebP; 10 MB), stored privately and served at /media/:id.
 * An image used as a featured image cannot be deleted.
 */
export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const { q, id } = await searchParams;
  const assets = await adminGet<Asset[]>('/admin/media');
  const list = (assets ?? []).filter((a) => matchesQ(q, a.altText, a.id));
  const selected = list.find((a) => a.id === id) ?? list[0] ?? null;
  return (
    <>
      <AdminHeader section="Content Management" title="Media Library" description="Upload and manage images for blog posts, resources and case studies." />
      <Panel title="Upload Image" description="PNG, JPEG, GIF or WebP up to 10 MB. Alt text describes the image for search engines and screen readers.">
        <UploadForm path="/admin/media" submitLabel="Upload">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <Field label="Image" htmlFor="m-file">
              <Input id="m-file" name="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" required />
            </Field>
            <Field label="Alt text" htmlFor="m-alt">
              <Input id="m-alt" name="altText" maxLength={300} placeholder="Describe the image" />
            </Field>
          </div>
        </UploadForm>
      </Panel>
      <section className={s.panel} style={{ marginTop: 16 }}>
        <form className={s.filters} role="search">
          <Input name="q" defaultValue={q} icon={<Search size={16} />} placeholder="Search by alt text..." aria-label="Search media" />
        </form>
        {!assets ? (
          <EmptyState icon={<ImageIcon size={28} />} title="Media unavailable" description="Your account cannot manage content, or the API is unavailable." />
        ) : list.length === 0 ? (
          <EmptyState icon={<ImageIcon size={28} />} title={assets.length ? 'No matches' : 'No media yet'} description="Uploaded images will appear here." />
        ) : (
          <div className={s.body}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, alignContent: 'start' }}>
              {list.map((a) => (
                <Link key={a.id} href={`/admin/media?${new URLSearchParams({ ...(q ? { q } : {}), id: a.id })}`} style={{ border: `2px solid ${a.id === selected?.id ? 'var(--blue)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-alt)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/media/${a.id}`} alt={a.altText ?? ''} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                  <small style={{ display: 'block', padding: '6px 8px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.altText || 'No alt text'}</small>
                </Link>
              ))}
            </div>
            {selected && (
              <aside className={s.details}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/${selected.id}`} alt={selected.altText ?? ''} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
                <dl>
                  <div>
                    <dt>Type</dt>
                    <dd>{selected.mimeType}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{kb(selected.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>Uploaded</dt>
                    <dd>{dateTime(selected.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>By</dt>
                    <dd>{selected.uploader.displayName ?? selected.uploader.email}</dd>
                  </div>
                  <div>
                    <dt>Used by</dt>
                    <dd>{selected._count.blogPosts} post(s)</dd>
                  </div>
                  <div>
                    <dt>URL</dt>
                    <dd>
                      <code>/media/{selected.id}</code>
                    </dd>
                  </div>
                </dl>
                <ApiForm key={selected.id} method="PATCH" path={`/admin/media/${selected.id}`} submitLabel="Save Alt Text" successMessage="Saved.">
                  <Input name="altText" data-type="nullable" defaultValue={selected.altText ?? ''} maxLength={300} aria-label="Alt text" />
                </ApiForm>
                <ActionButton variant="ghost" method="DELETE" path={`/admin/media/${selected.id}`} confirm="Delete this image permanently?" redirectTo="/admin/media" disabled={selected._count.blogPosts > 0} title={selected._count.blogPosts ? 'Used as a featured image' : undefined}>
                  Delete
                </ActionButton>
              </aside>
            )}
          </div>
        )}
      </section>
    </>
  );
}
