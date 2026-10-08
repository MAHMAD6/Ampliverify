import Link from 'next/link';
import { Briefcase, Building2, FileText, Folder, Search, User } from 'lucide-react';
import { EmptyState, Input, PageHeader, Panel } from '@/components/ui';
import { StatusPill } from '@/components/admin/AdminList';
import { adminGet } from '@/lib/admin-data';

export const metadata = { title: 'Search' };

type Results = {
  users: { id: string; email: string; displayName: string | null; status: string }[];
  workspaces: { id: string; name: string; organization: { name: string } }[];
  projects: { id: string; name: string; workspace: { name: string } }[];
  content: { id: string; title: string; slug: string; status: string; type: 'BLOG' | 'GUIDE' | 'HELP' }[];
  jobs: { id: string; title: string; slug: string; status: string }[];
};

const CONTENT_HREF = { BLOG: '/admin/blog', GUIDE: '/admin/resources', HELP: '/admin/resources' };

/** Admin search across users, workspaces, projects, content and job openings. */
export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  const r = q.length >= 2 ? await adminGet<Results>(`/admin/search?q=${encodeURIComponent(q)}`) : null;
  const total = r ? r.users.length + r.workspaces.length + r.projects.length + r.content.length + r.jobs.length : 0;
  const section = (title: string, icon: React.ReactNode, items: { key: string; href?: string; label: React.ReactNode; meta: React.ReactNode }[]) =>
    items.length > 0 && (
      <Panel title={`${title} (${items.length})`} actions={icon}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {items.map((i) => (
            <li key={i.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
              {i.href ? (
                <Link href={i.href} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                  {i.label}
                </Link>
              ) : (
                <b>{i.label}</b>
              )}
              <span style={{ color: 'var(--muted)' }}>{i.meta}</span>
            </li>
          ))}
        </ul>
      </Panel>
    );
  return (
    <>
      <PageHeader title="Search" description={q ? `Results for “${q}”` : 'Search users, workspaces, projects, content and job openings.'} />
      <form role="search" style={{ marginBottom: 16, maxWidth: 560 }}>
        <Input name="q" defaultValue={q} icon={<Search size={16} />} placeholder="Search by name, email or title (2+ characters)" aria-label="Search" autoFocus />
      </form>
      {!q || q.length < 2 ? (
        <EmptyState icon={<Search size={28} />} title="Enter a search term" description="Type at least two characters." />
      ) : !r ? (
        <EmptyState icon={<Search size={28} />} title="Search unavailable" description="Your account cannot search platform records." />
      ) : total === 0 ? (
        <EmptyState icon={<Search size={28} />} title="No results" description={`Nothing matches “${q}”.`} />
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          {section('Users', <User size={18} />, r.users.map((u) => ({ key: u.id, href: `/admin/users/${u.id}`, label: u.displayName ?? u.email, meta: <StatusPill tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.email}</StatusPill> })))}
          {section('Workspaces', <Building2 size={18} />, r.workspaces.map((w) => ({ key: w.id, href: `/admin/subscriptions?q=${encodeURIComponent(w.name)}`, label: w.name, meta: w.organization.name })))}
          {section('Projects', <Folder size={18} />, r.projects.map((p) => ({ key: p.id, label: p.name, meta: p.workspace.name })))}
          {section('Content', <FileText size={18} />, r.content.map((c) => ({ key: c.id, href: `${CONTENT_HREF[c.type]}?q=${encodeURIComponent(c.title)}`, label: c.title, meta: `${c.type.toLowerCase()} · ${c.status.toLowerCase()}` })))}
          {section('Job Openings', <Briefcase size={18} />, r.jobs.map((j) => ({ key: j.id, href: `/admin/careers?q=${encodeURIComponent(j.title)}`, label: j.title, meta: j.status.toLowerCase() })))}
        </div>
      )}
    </>
  );
}
