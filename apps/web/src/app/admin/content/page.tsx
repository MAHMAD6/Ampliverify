import Link from 'next/link';
import { Image as ImageIcon, LibraryBig, Newspaper, Plus } from 'lucide-react';
import { AdminHeader, MetricRow } from '@/components/admin/AdminParts';
import { ButtonLink, Card, EmptyState, Grid, IconCircle, Panel } from '@/components/ui';
import s from '@/components/admin/parts.module.css';

export const metadata = { title: 'Content Overview' };

export default function ContentOverviewPage() {
  return (
    <>
      <AdminHeader
        section="Content Management"
        title="Content Overview"
        description="Manage published and draft content across AmpliVerify from one place."
        actions={
          <ButtonLink href="/admin/blog/new" icon={<Plus size={16} />}>
            Create Content
          </ButtonLink>
        }
      />
      <MetricRow
        items={[
          { label: 'Total Content Items', note: 'No content yet' },
          { label: 'Published', note: 'No published items' },
          { label: 'Drafts', note: 'No drafts yet' },
          { label: 'Scheduled', note: 'No scheduled content' },
        ]}
      />
      <Grid cols={3} style={{ marginBottom: 18 }}>
        {[
          { href: '/admin/blog', icon: <Newspaper size={22} />, kicker: 'Blog', title: 'Blog Posts', text: 'Create, edit, publish, unpublish, and manage blog content.' },
          { href: '/admin/resources', icon: <LibraryBig size={22} />, kicker: 'Resources', title: 'Resources & Articles', text: 'Manage educational resources and long-form reference content.' },
          { href: '/admin/media', icon: <ImageIcon size={22} />, kicker: 'Media', title: 'Media Library', text: 'Store and reuse approved images and files across content workflows.' },
        ].map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className={s.cardLink}>
              <IconCircle tone="blue">{c.icon}</IconCircle>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1 }}>{c.kicker}</span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </Card>
          </Link>
        ))}
      </Grid>
      <Panel title="Recent Content" description="Latest content activity will appear here.">
        <EmptyState icon={<Newspaper size={26} />} title="No content yet" description="Create your first content item or use the dedicated content sections in the sidebar." />
      </Panel>
    </>
  );
}
