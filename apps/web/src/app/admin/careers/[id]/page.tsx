import { notFound } from 'next/navigation';
import { JobEditor, type AdminJob } from '@/components/admin/JobEditor';
import { adminGet } from '@/lib/admin-data';

export const metadata = { title: 'Edit Job Opening' };

export default async function EditJobOpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await adminGet<AdminJob>(`/admin/jobs/${encodeURIComponent(id)}`);
  if (!job) notFound();
  return <JobEditor key={job.id} job={job} />;
}
