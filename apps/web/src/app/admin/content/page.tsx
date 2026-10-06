import Link from 'next/link';
import { BookOpen, Briefcase, FileText, Image as ImageIcon, Newspaper, Users } from 'lucide-react';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { AddMenu } from '@/components/admin/AddMenu';
import { date, matchesQ } from '@/lib/admin-data';
import { apiGet } from '@/lib/api';
import type { ContentSummary, JobSummary } from '@/lib/types';

export const metadata = { title: 'Content Overview' };

type Row = { title: string; type: string; author: string; date: string; href: string };

/**
 * Content Overview (chat design 2026-10-06; supersedes the earlier Content
 * Management overview). Published blog posts, guides and job openings from the
 * public APIs; media and unpublished items need the admin CMS API.
 */
export default async function ContentOverviewPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'all', q } = await searchParams;
  const [blog, guides, jobs] = await Promise.all([
    apiGet<ContentSummary[]>('/public/blog?limit=50'),
    apiGet<ContentSummary[]>('/public/guides?limit=50'),
    apiGet<JobSummary[]>('/public/careers'),
  ]);
  const all: Row[] = [
    ...(blog.ok ? blog.data.map((b) => ({ title: b.title, type: 'Blog Post', author: b.author?.displayName ?? '—', date: b.publishedAt, href: `/blog/${b.slug}` })) : []),
    ...(guides.ok ? guides.data.map((g) => ({ title: g.title, type: 'Resource', author: g.author?.displayName ?? '—', date: g.publishedAt, href: `/guides/${g.slug}` })) : []),
    ...(jobs.ok ? jobs.data.map((j) => ({ title: j.title, type: 'Job Opening', author: '—', date: j.publishedAt, href: `/careers/${j.slug}` })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const typeFor: Record<string, string> = { blog: 'Blog Post', resources: 'Resource', jobs: 'Job Opening', media: 'Media' };
  const rows = all.filter((r) => (tab === 'all' || r.type === typeFor[tab]) && matchesQ(q, r.title, r.author));
  const loaded = blog.ok && guides.ok && jobs.ok;
  return (
    <AdminList
      section="Content Management"
      title="Content Overview"
      description="Manage all website content including blog posts, resources, media, and job openings."
      actions={
        <AddMenu
          label="Create Content"
          items={[
            { title: 'Blog Post', text: 'Write a new article', icon: <Newspaper size={20} />, href: '/admin/blog/new' },
            { title: 'Resource', text: 'Guide or download', icon: <BookOpen size={20} />, href: '/admin/blog/new?type=guide' },
            { title: 'Job Opening', text: 'Publish a role', icon: <Briefcase size={20} />, href: '/admin/careers/new' },
            { title: 'Media', text: 'Upload a file', icon: <ImageIcon size={20} />, disabledReason: 'Uploads need the media API.' },
          ]}
        />
      }
      metrics={[
        { label: 'Total Content', icon: <FileText size={26} />, tone: 'blue', value: loaded ? all.length : undefined, note: 'All published content' },
        { label: 'Blog Posts', icon: <FileText size={26} />, tone: 'green', value: blog.ok ? blog.data.length : undefined, note: 'Published blog posts' },
        { label: 'Resources', icon: <BookOpen size={26} />, tone: 'purple', value: guides.ok ? guides.data.length : undefined, note: 'Guides and downloads' },
        { label: 'Job Openings', icon: <Users size={26} />, tone: 'amber', value: jobs.ok ? jobs.data.length : undefined, note: 'Active job postings' },
      ]}
      tabs={[
        { key: 'all', label: 'All Content' },
        { key: 'blog', label: 'Blog Posts' },
        { key: 'resources', label: 'Resources' },
        { key: 'media', label: 'Media' },
        { key: 'jobs', label: 'Job Openings' },
      ]}
      activeTab={tab}
      basePath="/admin/content"
      search="Search content by title or keyword..."
      liveFilters={{ q }}
      columns={['Title', 'Type', 'Author', 'Status', 'Published', 'Actions']}
      rows={rows.map((r) => [
        <b key="t">{r.title}</b>,
        r.type,
        r.author,
        <StatusPill key="s" tone="green">
          Published
        </StatusPill>,
        date(r.date),
        <Link key="v" href={r.href} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          View
        </Link>,
      ])}
      empty={{ icon: <FileText size={40} />, title: 'No content to display', text: 'Create and manage blog posts, resources, media, and job openings to build your website content in AmpliVerify.' }}
      footnote="Drafts, scheduled items and media appear once the admin content API is available."
    />
  );
}
