import { Briefcase, Plus } from 'lucide-react';
import { AdminHeader, ListPanel, MetricRow } from '@/components/admin/AdminParts';
import { ButtonLink, Notice } from '@/components/ui';

export const metadata = { title: 'Careers / Job Openings' };

export default function AdminCareersPage() {
  return (
    <>
      <AdminHeader
        section="Content Management"
        title="Careers / Job Openings"
        description="Create, publish, update, and close AmpliVerify job openings."
        actions={
          <ButtonLink href="/admin/careers/new" icon={<Plus size={16} />}>
            Create Job Opening
          </ButtonLink>
        }
      />
      <MetricRow
        items={[
          { label: 'Total Openings', note: 'No job openings yet' },
          { label: 'Published', note: 'No published openings' },
          { label: 'Drafts', note: 'No draft openings' },
          { label: 'Closed', note: 'No closed openings' },
        ]}
      />
      <ListPanel
        title="Job Openings"
        description="Manage careers content shown on the public careers page."
        search="Search by title, department, or location..."
        selects={['All statuses', 'All work types']}
        columns={['Title', 'Department', 'Location', 'Status', 'Published', 'Actions']}
        emptyIcon={<Briefcase size={26} />}
        emptyTitle="No job openings yet"
        emptyText="Create an opening when AmpliVerify is ready to recruit. Drafts remain unpublished until explicitly published."
        action={
          <ButtonLink href="/admin/careers/new" icon={<Plus size={16} />}>
            Create Job Opening
          </ButtonLink>
        }
      />
      <div style={{ marginTop: 16 }}>
        <Notice title="Publishing rule:">
          The public careers page shows only published, visible openings before their application deadline. Do not add sample roles, compensation, locations, or applicant counts.
        </Notice>
      </div>
    </>
  );
}
