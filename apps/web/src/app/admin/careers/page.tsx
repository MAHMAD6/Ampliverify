import Link from 'next/link';
import { Archive, Briefcase, CheckCircle2, FileText, Inbox, Plus } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import type { AdminJob } from '@/components/admin/JobEditor';
import { adminGet, date, matchesQ } from '@/lib/admin-data';

export const metadata = { title: 'Careers / Job Openings' };

const TYPE: Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', INTERNSHIP: 'Internship', TEMPORARY: 'Temporary' };
const TONE = { DRAFT: 'amber', PUBLISHED: 'green', CLOSED: 'slate', ARCHIVED: 'slate' } as const;
const TABS: Record<string, string | null> = { all: null, drafts: 'DRAFT', published: 'PUBLISHED', closed: 'CLOSED', archived: 'ARCHIVED' };

/** Careers (chat design 2026-10-06), from the admin careers API (drafts, closed and archived included). */
export default async function CareersAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'all', q } = await searchParams;
  const jobs = await adminGet<AdminJob[]>('/admin/jobs');
  const list = jobs ?? [];
  const count = (st: string) => (jobs ? list.filter((j) => j.status === st).length : undefined);
  const rows = list.filter((j) => (!TABS[tab] || j.status === TABS[tab]) && matchesQ(q, j.title, j.department, j.locationText));
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
      actions={
        <span style={{ display: 'flex', gap: 8 }}>
          <ButtonLink href="/admin/careers/applications" variant="outline" icon={<Inbox size={18} />}>
            Applications
          </ButtonLink>
          {create}
        </span>
      }
      metrics={[
        { label: 'Total Openings', icon: <Briefcase size={26} />, tone: 'blue', value: jobs ? list.length : undefined },
        { label: 'Published', icon: <CheckCircle2 size={26} />, tone: 'green', value: count('PUBLISHED') },
        { label: 'Drafts', icon: <FileText size={26} />, tone: 'amber', value: count('DRAFT') },
        { label: 'Closed / Archived', icon: <Archive size={26} />, tone: 'slate', value: jobs ? (count('CLOSED') ?? 0) + (count('ARCHIVED') ?? 0) : undefined },
      ]}
      tabs={[
        { key: 'all', label: 'All Openings' },
        { key: 'drafts', label: 'Drafts' },
        { key: 'published', label: 'Published' },
        { key: 'closed', label: 'Closed' },
        { key: 'archived', label: 'Archived' },
      ]}
      activeTab={tab}
      basePath="/admin/careers"
      search="Search job openings..."
      liveFilters={{ q }}
      columns={['Job Title', 'Department', 'Employment Type', 'Location / Remote', 'Status', 'Applications', 'Publish Date', 'Actions']}
      rows={rows.map((j) => [
        <Link key="t" href={`/admin/careers/${j.id}`} style={{ color: 'var(--ink)', fontWeight: 700 }}>
          {j.title}
        </Link>,
        j.department ?? '—',
        TYPE[j.employmentType] ?? j.employmentType,
        [j.locationText, j.workArrangement === 'REMOTE' ? 'Remote' : j.workArrangement === 'HYBRID' ? 'Hybrid' : j.workArrangement === 'ON_SITE' ? 'On-site' : null].filter(Boolean).join(' · ') || '—',
        <StatusPill key="s" tone={TONE[j.status]}>
          {j.status.charAt(0) + j.status.slice(1).toLowerCase()}
        </StatusPill>,
        <Link key="a" href={`/admin/careers/applications?job=${j.id}`} style={{ color: 'var(--blue)' }}>
          {j._count.applications}
        </Link>,
        j.publishedAt ? date(j.publishedAt) : '—',
        <span key="v" style={{ display: 'flex', gap: 10 }}>
          <Link href={`/admin/careers/${j.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
            Edit
          </Link>
          {j.status === 'PUBLISHED' && (
            <a href={`/careers/${j.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
              View
            </a>
          )}
        </span>,
      ])}
      empty={{ icon: <Briefcase size={40} />, title: jobs ? (list.length ? 'No openings match' : 'No job openings yet') : 'Openings unavailable', text: 'Create your first job opening to start attracting talent to your team.', action: create }}
    />
  );
}
