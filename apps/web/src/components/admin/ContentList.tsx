import Link from 'next/link';
import type { ReactNode } from 'react';
import { Archive, CheckCircle2, Clock3, FileText, Plus } from 'lucide-react';
import { ButtonLink } from '../ui';
import { AdminList, StatusPill } from './AdminList';
import { date, matchesQ } from '@/lib/admin-data';
import type { ContentSummary } from '@/lib/types';

export const CONTENT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
];

/**
 * CMS list pages (Blog Posts, Resources; chat designs 2026-10-06). Published
 * items come from the public content API, so they are real records; drafts,
 * scheduled and archived items need the admin CMS API and show empty states.
 */
export function ContentList({
  title,
  description,
  noun,
  createHref,
  icon,
  items,
  loaded,
  tab = 'all',
  q,
  basePath,
  publicBase,
  emptyText,
}: {
  title: string;
  description: string;
  noun: string;
  createHref: string;
  icon: ReactNode;
  items: ContentSummary[];
  loaded: boolean;
  tab?: string;
  q?: string;
  basePath: string;
  publicBase: string;
  emptyText: string;
}) {
  const showPublished = tab === 'all' || tab === 'published';
  const rows = showPublished ? items.filter((i) => matchesQ(q, i.title, i.excerpt, i.author?.displayName)) : [];
  const create = (
    <ButtonLink href={createHref} icon={<Plus size={18} />}>
      Create {noun}
    </ButtonLink>
  );
  return (
    <AdminList
      section="Content Management"
      title={title}
      description={description}
      actions={create}
      metrics={[
        { label: `Total ${title}`, icon: <FileText size={26} />, tone: 'blue', note: 'Needs the admin CMS API' },
        { label: 'Published', icon: <CheckCircle2 size={26} />, tone: 'green', value: loaded ? items.length : undefined, note: 'Live on website' },
        { label: 'Drafts', icon: <Clock3 size={26} />, tone: 'purple', note: 'Not yet published' },
        { label: 'Archived', icon: <Archive size={26} />, tone: 'amber', note: 'Not visible on website' },
      ]}
      tabs={CONTENT_TABS.map((t) => ({ ...t, label: t.key === 'all' ? `All ${title.split(' ').pop()}` : t.label }))}
      activeTab={tab}
      basePath={basePath}
      search={`Search ${title.toLowerCase()}...`}
      liveFilters={{ q }}
      columns={['Title', 'Author', 'Category', 'Status', 'Publish Date', 'Actions']}
      rows={rows.map((i) => [
        <b key="t">{i.title}</b>,
        i.author?.displayName ?? '—',
        i.category?.name ?? '—',
        <StatusPill key="s" tone="green">
          Published
        </StatusPill>,
        date(i.publishedAt),
        <Link key="v" href={`${publicBase}/${i.slug}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          View
        </Link>,
      ])}
      empty={{ icon, title: showPublished ? `No ${title.toLowerCase()} yet` : `No ${CONTENT_TABS.find((t) => t.key === tab)?.label.toLowerCase()} ${title.toLowerCase()}`, text: emptyText, action: create }}
      footnote="Drafts, scheduled and archived items appear once the admin content API is available."
    />
  );
}
