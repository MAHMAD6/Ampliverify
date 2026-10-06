import Link from 'next/link';
import { Archive, Briefcase, CheckCircle2, FileText, Plus } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { date, matchesQ } from '@/lib/admin-data';
import { apiGet } from '@/lib/api';
import type { JobSummary } from '@/lib/types';

export const metadata = { title: 'Careers / Job Openings' };

const TYPE: Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', INTERNSHIP: 'Internship', TEMPORARY: 'Temporary' };

/** Careers (chat design 2026-10-06). Published openings are live from `/public/careers`; drafts/archived need the admin API. */
export default async function CareersAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'all', q } = await searchParams;
  const jobs = await apiGet<JobSummary[]>('/public/careers');
  const list = jobs.ok ? jobs.data : [];
  const rows = tab === 'all' || tab === 'published' ? list.filter((j) => matchesQ(q, j.title, j.department, j.locationText)) : [];
  const create = (
    <ButtonLink href="/admin/careers/new" icon={<Plus size={18} />}>
      Create Job Opening
    </ButtonLink>
  );
  return (
    <AdminList
      section="Content Management"
      title="Careers / Job Openings"
      description="Manage job openings and attract top talent to your team."
      actions={create}
      metrics={[
        { label: 'Total Openings', icon: <Briefcase size={26} />, tone: 'blue', note: 'Needs the admin CMS API' },
        { label: 'Published', icon: <CheckCircle2 size={26} />, tone: 'green', value: jobs.ok ? list.length : undefined },
        { label: 'Drafts', icon: <FileText size={26} />, tone: 'amber' },
        { label: 'Archived', icon: <Archive size={26} />, tone: 'slate' },
      ]}
      tabs={[
        { key: 'all', label: 'All Openings' },
        { key: 'drafts', label: 'Drafts' },
        { key: 'published', label: 'Published' },
        { key: 'archived', label: 'Archived' },
      ]}
      activeTab={tab}
      basePath="/admin/careers"
      search="Search job openings..."
      liveFilters={{ q }}
      columns={['Job Title', 'Department', 'Employment Type', 'Location / Remote', 'Status', 'Publish Date', 'Actions']}
      rows={rows.map((j) => [
        <b key="t">{j.title}</b>,
        j.department ?? '—',
        TYPE[j.employmentType] ?? j.employmentType,
        [j.locationText, j.workArrangement === 'REMOTE' ? 'Remote' : j.workArrangement === 'HYBRID' ? 'Hybrid' : null].filter(Boolean).join(' · ') || '—',
        <StatusPill key="s" tone="green">
          Published
        </StatusPill>,
        date(j.publishedAt),
        <Link key="v" href={`/careers/${j.slug}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          View
        </Link>,
      ])}
      empty={{ icon: <Briefcase size={40} />, title: 'No job openings yet', text: 'Create your first job opening to start attracting talent to your team.', action: create }}
    />
  );
}
