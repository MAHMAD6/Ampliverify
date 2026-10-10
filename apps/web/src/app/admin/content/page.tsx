import Link from 'next/link';
import { BookOpen, Briefcase, CalendarDays, FileText, Image as ImageIcon, Layers, LifeBuoy, Newspaper, PlayCircle } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminParts';
import { AddMenu } from '@/components/admin/AddMenu';
import { DataTable, Panel } from '@/components/ui';
import { adminGet, dateTime } from '@/lib/admin-data';
import s from '@/components/admin/list.module.css';

export const metadata = { title: 'Content Overview' };

type Counts = { draft: number; published: number; archived: number };
type Overview = {
  blog: Counts;
  guides: Counts;
  help: Counts;
  caseStudies: Counts;
  videos: number;
  events: number;
  media: number;
  jobs: Record<string, number>;
  recent: { id: string; eventType: string; targetType: string; createdAt: string }[];
};

/** Content Overview (chat design 2026-10-06): counts per content type from the admin CMS API and recent content changes. */
export default async function ContentOverviewPage() {
  const o = await adminGet<Overview>('/admin/content/overview');
  const total = (c?: Counts) => (c ? c.draft + c.published + c.archived : undefined);
  const cards = [
    { label: 'Blog Posts', href: '/admin/blog', icon: <Newspaper size={22} />, c: o?.blog },
    { label: 'Resources', href: '/admin/resources', icon: <BookOpen size={22} />, c: o?.guides },
    { label: 'Help Articles', href: '/admin/help', icon: <LifeBuoy size={22} />, c: o?.help },
    { label: 'Case Studies', href: '/admin/case-studies', icon: <Layers size={22} />, c: o?.caseStudies },
  ];
  const others = [
    { label: 'Media', href: '/admin/media', icon: <ImageIcon size={22} />, value: o?.media },
    { label: 'Videos', href: '/admin/videos', icon: <PlayCircle size={22} />, value: o?.videos },
    { label: 'Webinars & Events', href: '/admin/events', icon: <CalendarDays size={22} />, value: o?.events },
    { label: 'Job Openings', href: '/admin/careers', icon: <Briefcase size={22} />, value: o ? Object.values(o.jobs).reduce((n, v) => n + v, 0) : undefined },
  ];
  return (
    <>
      <AdminHeader
        section="Content Management"
        title="Content Overview"
        description="Manage all website content including blog posts, resources, media, and job openings."
        actions={
          <AddMenu
            label="Create Content"
            items={[
              { title: 'Blog Post', text: 'Write a new article', icon: <Newspaper size={20} />, href: '/admin/blog/new' },
              { title: 'Resource', text: 'Guide or download', icon: <BookOpen size={20} />, href: '/admin/resources/new' },
              { title: 'Help Article', text: 'Answer a customer question', icon: <LifeBuoy size={20} />, href: '/admin/help/new' },
              { title: 'Case Study', text: 'Customer story', icon: <Layers size={20} />, href: '/admin/case-studies/new' },
              { title: 'Job Opening', text: 'Publish a role', icon: <Briefcase size={20} />, href: '/admin/careers/new' },
              { title: 'Media', text: 'Upload an image', icon: <ImageIcon size={20} />, href: '/admin/media' },
            ]}
          />
        }
      />
      <div className={s.metrics} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={s.metric}>
            <span className={s.icon} data-tone="blue">
              {c.icon}
            </span>
            <span>
              <small>{c.label}</small>
              <b>{total(c.c) ?? '—'}</b>
              {c.c && (
                <em>
                  {c.c.published} published · {c.c.draft} drafts
                </em>
              )}
            </span>
          </Link>
        ))}
        {others.map((c) => (
          <Link key={c.label} href={c.href} className={s.metric}>
            <span className={s.icon} data-tone="green">
              {c.icon}
            </span>
            <span>
              <small>{c.label}</small>
              <b>{c.value ?? '—'}</b>
            </span>
          </Link>
        ))}
      </div>
      <Panel title="Recent Content Changes" description="From the audit log." bodyless>
        <DataTable
          columns={['Change', 'Item', 'When']}
          rows={(o?.recent ?? []).map((r) => [
            <Link key="e" href={`/admin/audit-logs/${r.id}`} style={{ color: 'var(--blue)' }}>
              <code>{r.eventType}</code>
            </Link>,
            r.targetType.replace(/_/g, ' '),
            dateTime(r.createdAt),
          ])}
          empty={
            <p style={{ padding: 16, color: 'var(--muted)', fontSize: 14 }}>
              <FileText size={14} /> {o ? 'No content changes yet.' : 'Content data unavailable.'}
            </p>
          }
        />
      </Panel>
    </>
  );
}
