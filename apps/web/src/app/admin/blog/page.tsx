import { Newspaper, Plus } from 'lucide-react';
import { AdminHeader, ListPanel, MetricRow } from '@/components/admin/AdminParts';
import { ButtonLink } from '@/components/ui';

export const metadata = { title: 'Blog Posts' };

export default function AdminBlogPage() {
  return (
    <>
      <AdminHeader
        section="Content Management"
        title="Blog Posts"
        description="Create, organize, review, and publish AmpliVerify blog content."
        actions={
          <ButtonLink href="/admin/blog/new" icon={<Plus size={16} />}>
            New Blog Post
          </ButtonLink>
        }
      />
      <MetricRow
        items={[
          { label: 'Total Posts', note: 'No posts yet' },
          { label: 'Published', note: 'No published posts' },
          { label: 'Drafts', note: 'No drafts yet' },
          { label: 'Scheduled', note: 'No scheduled posts' },
        ]}
      />
      <ListPanel
        title="Blog Posts"
        description="Post title, author, status, publication date, and actions."
        search="Search blog posts..."
        selects={['All statuses', 'All authors', 'Newest first']}
        columns={['Title', 'Author', 'Status', 'Published', 'Actions']}
        emptyIcon={<Newspaper size={26} />}
        emptyTitle="No blog posts yet"
        emptyText="Start with a new draft. Posts remain unpublished until an authorized administrator explicitly publishes them."
        action={<ButtonLink href="/admin/blog/new">Create Blog Post</ButtonLink>}
      />
    </>
  );
}
