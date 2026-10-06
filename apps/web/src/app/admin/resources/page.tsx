import { LibraryBig, Plus } from 'lucide-react';
import { AdminHeader, ListPanel, MetricRow } from '@/components/admin/AdminParts';
import { ButtonLink } from '@/components/ui';

export const metadata = { title: 'Resources' };

/** "Resources" in Super Admin are the public Guides (guides table). */
export default function AdminResourcesPage() {
  return (
    <>
      <AdminHeader
        section="Content Management"
        page="Resources"
        title="Resources & Articles"
        description="Manage educational resources and reference content available across AmpliVerify."
        actions={
          <ButtonLink href="/admin/blog/new?type=guide" icon={<Plus size={16} />}>
            New Resource
          </ButtonLink>
        }
      />
      <MetricRow
        items={[
          { label: 'Total Resources', note: 'No resources yet' },
          { label: 'Published', note: 'No published resources' },
          { label: 'Drafts', note: 'No drafts yet' },
          { label: 'Archived', note: 'No archived resources' },
        ]}
      />
      <ListPanel
        title="Resource Library"
        description="Resource title, type, status, updated date, and actions."
        search="Search resources..."
        selects={['All types', 'All statuses', 'Newest first']}
        columns={['Title', 'Type', 'Status', 'Updated', 'Actions']}
        emptyIcon={<LibraryBig size={26} />}
        emptyTitle="No resources yet"
        emptyText="Create an article or resource when content is ready. Drafts stay private until an authorized administrator publishes them."
        action={<ButtonLink href="/admin/blog/new?type=guide">Create Resource</ButtonLink>}
      />
    </>
  );
}
