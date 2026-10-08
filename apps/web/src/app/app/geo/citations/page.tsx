import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable, geoPeriod, loadGeo } from '@/components/app/geo/GeoShell';
import { apiGet, qs } from '@/lib/api';
import s from '@/components/app/geo/geo.module.css';

export const metadata = { title: 'Citations · AI Search (GEO)' };

type CitationRow = { domain: string; own: boolean; citations: number; platforms: string[]; prompts: number; urls: { url: string; title: string | null }[] };

/** Citations tab = the page map's Sources & Citations: domains cited in the latest answers for each prompt. */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = geoPeriod((await searchParams).period);
  const { project } = await loadGeo(period);
  const res = project ? await apiGet<CitationRow[]>(`/user/projects/${project.id}/geo/citations${qs({ period })}`, { auth: true }) : null;
  const rows = res?.ok ? res.data : [];
  return (
    <GeoShell tab="citations" period={period}>
      <GeoTable
        columns={['Source', 'Citations', 'Prompts', 'Platforms', 'Cited Pages']}
        rows={rows.map((r) => [
          <span key="d">
            <b>{r.domain}</b> {r.own && <Badge tone="green">Your site</Badge>}
          </span>,
          r.citations,
          r.prompts,
          <span key="p" className={s.chips}>
            {r.platforms.map((p) => (
              <span key={p} className={s.chip}>
                {p}
              </span>
            ))}
          </span>,
          <span key="u" style={{ display: 'grid', gap: 2, maxWidth: 420 }}>
            {r.urls.slice(0, 3).map((u) => (
              <a key={u.url} href={u.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--blue)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.title || u.url}
              </a>
            ))}
            {r.urls.length > 3 && <span className={s.sub}>+{r.urls.length - 3} more</span>}
          </span>,
        ])}
        empty={<StateView kind="empty" compact icon={<Link2 size={28} />} title="No citations yet" description="Citations appear after a prompt check finds sources in AI answers for this period." />}
      />
    </GeoShell>
  );
}
