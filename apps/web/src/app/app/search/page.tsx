import Link from 'next/link';
import { Search } from 'lucide-react';
import { EmptyState, PageHeader, Panel } from '@/components/ui';
import { apiGet, apiList } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Search' };

type Doc = { id: string; title: string; status: string };
type Report = { id: string; title: string };
type KeywordList = { id: string; name: string; count: number };

/** Searches projects, and in the selected project editor documents, reports and keyword lists, plus the Help Center and guides. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  const { projects, selectedProject } = await getAppContext();
  const t = q.toLowerCase();
  const has = (v: string | null | undefined) => !!v && v.toLowerCase().includes(t);
  const pid = selectedProject?.id;
  const [docs, reports, lists, help, guides] = q
    ? await Promise.all([
        pid ? apiGet<Doc[]>(`/user/projects/${pid}/editor/documents`, { auth: true }) : null,
        apiGet<Report[]>(`/user/reports?q=${encodeURIComponent(q)}`, { auth: true }),
        pid ? apiGet<KeywordList[]>(`/user/projects/${pid}/keyword-lists`, { auth: true }) : null,
        apiList<ContentSummary>(`/public/help?q=${encodeURIComponent(q)}&limit=10`),
        apiList<ContentSummary>(`/public/guides?q=${encodeURIComponent(q)}&limit=10`),
      ])
    : [null, null, null, [], []];
  const groups: { title: string; items: { key: string; href: string; label: string; meta?: string }[] }[] = q
    ? [
        { title: 'Projects', items: projects.filter((p) => has(p.name) || has(p.primaryDomain)).map((p) => ({ key: p.id, href: `/app/projects/${p.id}`, label: p.name, meta: p.primaryDomain ?? undefined })) },
        { title: 'Editor Documents', items: (docs?.ok ? docs.data : []).filter((d) => has(d.title)).map((d) => ({ key: d.id, href: `/app/editor/${d.id}`, label: d.title, meta: d.status.toLowerCase() })) },
        { title: 'Reports', items: (reports?.ok ? reports.data : []).filter((r) => has(r.title)).map((r) => ({ key: r.id, href: `/app/reports/${r.id}`, label: r.title })) },
        { title: 'Keyword Lists', items: (lists?.ok ? lists.data : []).filter((l) => has(l.name)).map((l) => ({ key: l.id, href: `/app/keywords/lists?list=${l.id}`, label: l.name, meta: `${l.count} keywords` })) },
        { title: 'Help Center', items: help.map((h) => ({ key: h.slug, href: `/help/${h.slug}`, label: h.title })) },
        { title: 'Guides', items: guides.map((g) => ({ key: g.slug, href: `/guides/${g.slug}`, label: g.title })) },
      ].filter((g) => g.items.length > 0)
    : [];
  return (
    <>
      <PageHeader title="Search" description={q ? `Results for “${q}”${selectedProject ? ` · project ${selectedProject.name}` : ''}` : 'Search your projects, documents, reports, keywords, or help.'} />
      <form role="search" style={{ marginBottom: 16, maxWidth: 560 }}>
        <input name="q" defaultValue={q} placeholder="Search…" aria-label="Search" style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--line-strong)', borderRadius: 8 }} />
      </form>
      {!q ? (
        <EmptyState icon={<Search size={26} />} title="Enter a search term" description="Use the box above or the search in the top bar." />
      ) : groups.length === 0 ? (
        <EmptyState icon={<Search size={26} />} title="No results" description="Try a different term, or browse the Help Center." />
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {groups.map((g) => (
            <Panel key={g.title} title={`${g.title} (${g.items.length})`} bodyless>
              <ul style={{ listStyle: 'none', margin: 0, padding: '8px 20px' }}>
                {g.items.map((i) => (
                  <li key={i.key} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <Link href={i.href} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                      {i.label}
                    </Link>
                    {i.meta && <span style={{ color: 'var(--muted)', fontSize: 13 }}>{i.meta}</span>}
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
