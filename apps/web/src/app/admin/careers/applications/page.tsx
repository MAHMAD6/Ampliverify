import Link from 'next/link';
import { Inbox, ShieldAlert } from 'lucide-react';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, dateTime } from '@/lib/admin-data';

export const metadata = { title: 'Applications · Careers' };

type Application = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  submittedAt: string;
  job: { id: string; title: string };
  files: { id: string; malwareScanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'FAILED' }[];
};

const APP_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'];
const TONE: Record<string, 'blue' | 'amber' | 'green' | 'red' | 'slate'> = { SUBMITTED: 'blue', IN_REVIEW: 'amber', INTERVIEWING: 'amber', OFFERED: 'green', HIRED: 'green', REJECTED: 'red', WITHDRAWN: 'slate' };
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ');

/** Job applications across openings; files are downloadable only after a clean malware scan. */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ job?: string; status?: string; q?: string }> }) {
  const { job, status, q } = await searchParams;
  const params = new URLSearchParams({ ...(job ? { jobId: job } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}) });
  const [apps, jobs] = await Promise.all([adminGet<Application[]>(`/admin/applications?${params}`), adminGet<{ id: string; title: string }[]>('/admin/jobs')]);
  const list = apps ?? [];
  return (
    <AdminList
      section="Content Management"
      title="Applications"
      description="Review applications, move candidates through the process and download their files."
      metrics={[
        { label: 'Applications', icon: <Inbox size={24} />, tone: 'blue', value: apps ? list.length : undefined },
        { label: 'New', icon: <Inbox size={24} />, tone: 'amber', value: apps ? list.filter((a) => a.status === 'SUBMITTED').length : undefined },
        { label: 'In Progress', icon: <Inbox size={24} />, tone: 'purple', value: apps ? list.filter((a) => ['IN_REVIEW', 'INTERVIEWING', 'OFFERED'].includes(a.status)).length : undefined },
        { label: 'Files Awaiting Scan', icon: <ShieldAlert size={24} />, tone: 'red', value: apps ? list.flatMap((a) => a.files).filter((f) => f.malwareScanStatus === 'PENDING').length : undefined },
      ]}
      basePath="/admin/careers/applications"
      search="Search by name or email..."
      liveFilters={{ q }}
      selects={[
        { label: 'Opening', name: 'job', value: job, options: ['All Openings', ...(jobs ?? []).map((j) => [j.id, j.title] as [string, string])] },
        { label: 'Status', name: 'status', value: status, options: ['All Statuses', ...APP_STATUSES.map((s) => [s, label(s)] as [string, string])] },
      ]}
      columns={['Candidate', 'Opening', 'Status', 'Files', 'Submitted', '']}
      rows={list.map((a) => [
        <span key="c">
          <b>
            {a.firstName} {a.lastName}
          </b>
          <small style={{ display: 'block', color: 'var(--muted)' }}>{a.email}</small>
        </span>,
        a.job.title,
        <StatusPill key="s" tone={TONE[a.status] ?? 'slate'}>
          {label(a.status)}
        </StatusPill>,
        a.files.length ? a.files.map((f) => label(f.malwareScanStatus)).join(', ') : 'None',
        dateTime(a.submittedAt),
        <Link key="v" href={`/admin/careers/applications/${a.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          Review
        </Link>,
      ])}
      empty={{ icon: <Inbox size={40} />, title: apps ? 'No applications' : 'Applications unavailable', text: apps ? 'Applications submitted on the careers page appear here.' : 'Your account cannot read applications, or the API is unavailable.' }}
    />
  );
}
