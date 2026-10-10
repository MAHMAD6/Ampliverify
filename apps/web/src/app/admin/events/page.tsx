import { DataTable, Field, Input, Panel, Select, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime } from '@/lib/admin-data';

export const metadata = { title: 'Webinars & Events' };

type Event = { id: string; title: string; slug: string; summary: string | null; eventType: string; startsAt: string; endsAt: string | null; timezone: string; locationText: string | null; registrationUrl: string | null; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' };

const TONE = { DRAFT: 'amber', PUBLISHED: 'green', ARCHIVED: 'slate' } as const;
const local = (iso: string | null) => (iso ? iso.slice(0, 16) : '');

function EventFields({ e, id }: { e?: Event; id: string }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        <Field label="Title" htmlFor={`${id}-t`}>
          <Input id={`${id}-t`} name="title" required maxLength={300} defaultValue={e?.title} />
        </Field>
        <Field label="Type" htmlFor={`${id}-y`}>
          <Select id={`${id}-y`} name="eventType" defaultValue={e?.eventType ?? 'WEBINAR'}>
            <option value="WEBINAR">Webinar</option>
            <option value="LIVE_EVENT">Live event</option>
            <option value="WORKSHOP">Workshop</option>
            <option value="CONFERENCE">Conference</option>
          </Select>
        </Field>
        <Field label="Starts (UTC)" htmlFor={`${id}-s`}>
          <Input id={`${id}-s`} name="startsAt" type="datetime-local" data-type="utc" required defaultValue={local(e?.startsAt ?? null)} />
        </Field>
        <Field label="Ends (UTC, optional)" htmlFor={`${id}-e`}>
          <Input id={`${id}-e`} name="endsAt" type="datetime-local" data-type="utc" defaultValue={local(e?.endsAt ?? null)} />
        </Field>
        <Field label="Location" htmlFor={`${id}-l`}>
          <Input id={`${id}-l`} name="locationText" data-type="nullable" maxLength={300} defaultValue={e?.locationText ?? ''} placeholder="Online" />
        </Field>
        <Field label="Registration URL" htmlFor={`${id}-r`}>
          <Input id={`${id}-r`} name="registrationUrl" type="url" data-type="nullable" defaultValue={e?.registrationUrl ?? ''} placeholder="https://" />
        </Field>
        <Field label="Status" htmlFor={`${id}-st`}>
          <Select id={`${id}-st`} name="status" defaultValue={e?.status ?? 'DRAFT'}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </Field>
      </div>
      <input type="hidden" name="timezone" value="UTC" />
      <Field label="Summary" htmlFor={`${id}-x`}>
        <Textarea id={`${id}-x`} name="summary" data-type="nullable" rows={2} maxLength={2000} defaultValue={e?.summary ?? ''} />
      </Field>
    </div>
  );
}

/** Webinars and events; published ones appear on the public Webinars & Videos page. Times are entered in UTC. */
export default async function EventsPage() {
  const events = await adminGet<Event[]>('/admin/events');
  return (
    <>
      <AdminHeader section="Content Management" title="Webinars & Events" description="Create and manage webinars, virtual events, and recordings." />
      <div style={{ display: 'grid', gap: 16 }}>
        <Panel title="New Event">
          <ApiForm path="/admin/events" submitLabel="Add Event" resetOnSuccess successMessage="Event added.">
            <EventFields id="ne" />
          </ApiForm>
        </Panel>
        <Panel title={`Events (${events?.length ?? 0})`} bodyless>
          <DataTable
            columns={['Event', 'Starts', 'Location', 'Status', 'Edit', '']}
            rows={(events ?? []).map((e) => [
              <span key="t">
                <b>{e.title}</b>
                <small style={{ display: 'block', color: 'var(--muted)' }}>{e.eventType.replace(/_/g, ' ').toLowerCase()}</small>
              </span>,
              dateTime(e.startsAt),
              e.locationText ?? '—',
              <StatusPill key="s" tone={TONE[e.status]}>
                {e.status.charAt(0) + e.status.slice(1).toLowerCase()}
              </StatusPill>,
              <details key="ed">
                <summary style={{ cursor: 'pointer', color: 'var(--blue)' }}>Edit</summary>
                <ApiForm method="PATCH" path={`/admin/events/${e.id}`} successMessage="Saved.">
                  <EventFields e={e} id={`e-${e.id}`} />
                </ApiForm>
              </details>,
              <ActionButton key="d" size="sm" variant="ghost" method="DELETE" path={`/admin/events/${e.id}`} confirm={`Delete “${e.title}”?`}>
                Delete
              </ActionButton>,
            ])}
            empty={<p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>{events ? 'No events yet.' : 'Events unavailable.'}</p>}
          />
        </Panel>
      </div>
    </>
  );
}
