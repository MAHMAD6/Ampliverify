import Link from 'next/link';
import type { ReactNode } from 'react';
import { Archive, CheckCircle2, Clock3, FileText, Plus } from 'lucide-react';
import { ButtonLink } from '../ui';
import { AdminList, StatusPill } from './AdminList';
import { adminGet, date, matchesQ } from '@/lib/admin-data';
import { CMS_KINDS, type AdminArticle, type CmsKind } from './cms';

export const CONTENT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
];

const stateOf = (a: AdminArticle) => (a.status === 'PUBLISHED' && a.publishedAt && new Date(a.publishedAt) > new Date() ? 'scheduled' : a.status === 'DRAFT' ? 'drafts' : a.status === 'ARCHIVED' ? 'archived' : 'published');
const TONE = { drafts: 'amber', scheduled: 'blue', published: 'green', archived: 'slate' } as const;
const LABEL = { drafts: 'Draft', scheduled: 'Scheduled', published: 'Published', archived: 'Archived' };

/** CMS list pages (Blog Posts, Resources, Help Articles, Case Studies; chat designs 2026-10-06), from the admin CMS API. */
export async function ContentList({ kind, description, icon, emptyText, tab = 'all', q }: { kind: CmsKind; description: string; icon: ReactNode; emptyText: string; tab?: string; q?: string }) {
  const k = CMS_KINDS[kind];
  const items = await adminGet<AdminArticle[]>(`/admin/content/${kind}`);
  const list = items ?? [];
  const count = (t: string) => (items ? list.filter((a) => stateOf(a) === t).length : undefined);
  const rows = list.filter((a) => (tab === 'all' || stateOf(a) === tab) && matchesQ(q, a.title, a.excerpt, a.author?.displayName, a.customerName));
  const create = (
    <ButtonLink href={`${k.admin}/new`} icon={<Plus size={18} />}>
      Create {k.noun}
    </ButtonLink>
  );
  return (
    <AdminList
      section="Content Management"
      title={k.plural}
      description={description}
      actions={create}
      metrics={[
        { label: `Total ${k.plural}`, icon: <FileText size={26} />, tone: 'blue', value: items ? list.length : undefined },
        { label: 'Published', icon: <CheckCircle2 size={26} />, tone: 'green', value: count('published'), note: 'Live on website' },
        { label: 'Drafts & Scheduled', icon: <Clock3 size={26} />, tone: 'purple', value: items ? (count('drafts') ?? 0) + (count('scheduled') ?? 0) : undefined, note: 'Not yet live' },
        { label: 'Archived', icon: <Archive size={26} />, tone: 'amber', value: count('archived'), note: 'Not visible on website' },
      ]}
      tabs={CONTENT_TABS.map((t) => ({ ...t, label: t.key === 'all' ? `All ${k.plural.split(' ').pop()}` : t.label }))}
      activeTab={tab}
      basePath={k.admin}
      search={`Search ${k.plural.toLowerCase()}...`}
      liveFilters={{ q }}
      columns={[kind === 'case-studies' ? 'Title / Customer' : 'Title', kind === 'blog' ? 'Author' : kind === 'case-studies' ? 'Industry' : 'Category', 'Status', 'Publish Date', 'Updated', 'Actions']}
      rows={rows.map((a) => {
        const st = stateOf(a);
        return [
          <span key="t">
            <Link href={`${k.admin}/${a.id}`} style={{ color: 'var(--ink)', fontWeight: 700 }}>
              {a.title}
            </Link>
            <small style={{ display: 'block', color: 'var(--muted)' }}>{kind === 'case-studies' ? a.customerName : `/${a.slug}`}</small>
          </span>,
          kind === 'blog' ? (a.author?.displayName ?? '—') : kind === 'case-studies' ? (a.industry ?? '—') : (a.category?.name ?? '—'),
          <StatusPill key="s" tone={TONE[st]}>
            {LABEL[st]}
          </StatusPill>,
          a.publishedAt ? date(a.publishedAt) : '—',
          date(a.updatedAt),
          <span key="a" style={{ display: 'flex', gap: 10 }}>
            <Link href={`${k.admin}/${a.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
              Edit
            </Link>
            {st === 'published' && (
              <a href={`${k.publicBase}/${a.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
                View
              </a>
            )}
          </span>,
        ];
      })}
      empty={{ icon, title: items ? (list.length ? 'Nothing matches your filters' : `No ${k.plural.toLowerCase()} yet`) : 'Content unavailable', text: items ? emptyText : 'Your account cannot manage content, or the API is unavailable.', action: items && !list.length ? create : undefined }}
    />
  );
}
