import { DataTable, Field, Input, Panel, Select, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, date } from '@/lib/admin-data';

export const metadata = { title: 'Videos' };

type Video = { id: string; title: string; slug: string; description: string | null; videoUrl: string; durationSec: number | null; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; publishedAt: string | null; updatedAt: string };

const TONE = { DRAFT: 'amber', PUBLISHED: 'green', ARCHIVED: 'slate' } as const;
const mmss = (s: number | null) => (s === null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

function VideoFields({ v, id }: { v?: Video; id: string }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        <Field label="Title" htmlFor={`${id}-t`}>
          <Input id={`${id}-t`} name="title" required maxLength={300} defaultValue={v?.title} />
        </Field>
        <Field label="Video URL" htmlFor={`${id}-u`} hint="YouTube, Vimeo or a hosted file (https).">
          <Input id={`${id}-u`} name="videoUrl" type="url" required defaultValue={v?.videoUrl} placeholder="https://www.youtube.com/watch?v=…" />
        </Field>
        <Field label="Duration (seconds)" htmlFor={`${id}-d`}>
          <Input id={`${id}-d`} name="durationSec" type="number" data-type="number" min={0} defaultValue={v?.durationSec ?? ''} />
        </Field>
        <Field label="Status" htmlFor={`${id}-s`}>
          <Select id={`${id}-s`} name="status" defaultValue={v?.status ?? 'DRAFT'}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor={`${id}-x`}>
        <Textarea id={`${id}-x`} name="description" data-type="nullable" rows={2} maxLength={2000} defaultValue={v?.description ?? ''} />
      </Field>
    </div>
  );
}

/** Video library shown on the public Webinars & Videos page when published. */
export default async function VideosPage() {
  const videos = await adminGet<Video[]>('/admin/videos');
  return (
    <>
      <AdminHeader section="Content Management" title="Videos" description="Manage videos for your content library." />
      <div style={{ display: 'grid', gap: 16 }}>
        <Panel title="Add Video">
          <ApiForm path="/admin/videos" submitLabel="Add Video" resetOnSuccess successMessage="Video added.">
            <VideoFields id="nv" />
          </ApiForm>
        </Panel>
        <Panel title={`Videos (${videos?.length ?? 0})`} bodyless>
          <DataTable
            columns={['Video', 'Duration', 'Status', 'Updated', 'Edit', '']}
            rows={(videos ?? []).map((v) => [
              <span key="t">
                <b>{v.title}</b>
                <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--blue)', fontSize: 12 }}>
                  {v.videoUrl}
                </a>
              </span>,
              mmss(v.durationSec),
              <StatusPill key="s" tone={TONE[v.status]}>
                {v.status.charAt(0) + v.status.slice(1).toLowerCase()}
              </StatusPill>,
              date(v.updatedAt),
              <details key="e">
                <summary style={{ cursor: 'pointer', color: 'var(--blue)' }}>Edit</summary>
                <ApiForm method="PATCH" path={`/admin/videos/${v.id}`} successMessage="Saved.">
                  <VideoFields v={v} id={`v-${v.id}`} />
                </ApiForm>
              </details>,
              <ActionButton key="d" size="sm" variant="ghost" method="DELETE" path={`/admin/videos/${v.id}`} confirm={`Delete “${v.title}”?`}>
                Delete
              </ActionButton>,
            ])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>{videos ? 'No videos yet.' : 'Videos unavailable.'}</p>}
          />
        </Panel>
      </div>
    </>
  );
}
