import { notFound } from 'next/navigation';
import { EventDetail, loadEvent } from '@/components/admin/EventDetail';

export const metadata = { title: 'Event Detail · Admin Activity' };

/** One audit record. 404 when the log loaded but the record is not in it; the template shows "Not available" when the log could not be read. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { loaded, record, related, actorLabel } = await loadEvent((await params).id);
  if (loaded && !record) notFound();
  return <EventDetail record={record} related={related} actorLabel={actorLabel} back={{ href: '/admin/activity', label: 'Admin Activity' }} />;
}
