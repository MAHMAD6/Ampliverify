import { notFound } from 'next/navigation';
import { Download, ShieldCheck } from 'lucide-react';
import { ButtonLink, DataTable, Field, KeyValue, Panel, Select, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime } from '@/lib/admin-data';

export const metadata = { title: 'Application · Careers' };

type Detail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  message: string | null;
  status: string;
  submittedAt: string;
  job: { id: string; title: string; slug: string };
  files: { id: string; mimeType: string; sizeBytes: string; malwareScanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'FAILED'; createdAt: string }[];
  events: { id: string; eventType: string; createdAt: string; metadata: unknown }[];
  notes: { id: string; note?: string; body?: string; createdAt: string; author: { displayName: string | null; email: string } | null }[];
};

const STATUSES = ['SUBMITTED', 'IN_REVIEW', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'];
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
const SCAN_TONE = { CLEAN: 'green', PENDING: 'amber', INFECTED: 'red', FAILED: 'red' } as const;

/** One application: candidate details, scanned files, status, private notes and history. */
export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await adminGet<Detail>(`/admin/applications/${encodeURIComponent(id)}`);
  if (!a) notFound();
  return (
    <>
      <AdminHeader section="Content Management" parent={{ label: 'Applications', href: '/admin/careers/applications' }} page={`${a.firstName} ${a.lastName}`} title="Application" description={`Applied for ${a.job.title}.`} />
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Panel title="Candidate" flushHead>
          <KeyValue label="Name" value={`${a.firstName} ${a.lastName}`} />
          <KeyValue label="Email" value={<a href={`mailto:${a.email}`} style={{ color: 'var(--blue)' }}>{a.email}</a>} />
          <KeyValue label="Phone" value={a.phone ?? '—'} />
          <KeyValue label="LinkedIn" value={a.linkedinUrl ? <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--blue)' }}>Profile</a> : '—'} />
          <KeyValue label="Portfolio" value={a.portfolioUrl ? <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--blue)' }}>{a.portfolioUrl}</a> : '—'} />
          <KeyValue label="Opening" value={<a href={`/admin/careers/${a.job.id}`} style={{ color: 'var(--blue)' }}>{a.job.title}</a>} />
          <KeyValue label="Submitted" value={dateTime(a.submittedAt)} />
          {a.message && (
            <div style={{ marginTop: 12 }}>
              <b style={{ fontSize: 14 }}>Message</b>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text)' }}>{a.message}</p>
            </div>
          )}
        </Panel>
        <Panel title="Status" flushHead>
          <ApiForm method="PATCH" path={`/admin/applications/${a.id}`} submitLabel="Update Status" successMessage="Status updated.">
            <Field label="Stage" htmlFor="ap-status">
              <Select id="ap-status" name="status" defaultValue={a.status}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </Select>
            </Field>
          </ApiForm>
          <div style={{ marginTop: 16 }}>
            <b style={{ fontSize: 14 }}>Files</b>
            {a.files.length === 0 && <p style={{ fontSize: 14, color: 'var(--muted)' }}>No files attached.</p>}
            {a.files.map((f) => (
              <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <StatusPill tone={SCAN_TONE[f.malwareScanStatus]}>{f.malwareScanStatus === 'CLEAN' ? 'Scanned clean' : label(f.malwareScanStatus)}</StatusPill>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {f.mimeType} · {Math.round(Number(f.sizeBytes) / 1024)} KB
                </span>
                {f.malwareScanStatus === 'CLEAN' ? (
                  <ButtonLink size="sm" variant="outline" href={`/api/files/admin/applicant-files/${f.id}`} icon={<Download size={14} />}>
                    Download
                  </ButtonLink>
                ) : f.malwareScanStatus !== 'INFECTED' ? (
                  <ActionButton size="sm" variant="ghost" icon={<ShieldCheck size={14} />} path={`/admin/applicant-files/${f.id}/rescan`} body={{}}>
                    Scan again
                  </ActionButton>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Private Notes" description="Visible to administrators only." flushHead>
          <ApiForm path={`/admin/applications/${a.id}/notes`} submitLabel="Add Note" resetOnSuccess successMessage="Note added.">
            <Textarea name="note" required rows={3} maxLength={5000} aria-label="Note" />
          </ApiForm>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 10 }}>
            {a.notes.map((n) => (
              <li key={n.id} style={{ fontSize: 14, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{n.note ?? n.body}</p>
                <small style={{ color: 'var(--muted)' }}>
                  {n.author?.displayName ?? n.author?.email ?? 'Administrator'} · {dateTime(n.createdAt)}
                </small>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="History" bodyless>
          <DataTable columns={['Event', 'When']} rows={a.events.map((e) => [label(e.eventType), dateTime(e.createdAt)])} empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>No events.</p>} />
        </Panel>
      </div>
    </>
  );
}
