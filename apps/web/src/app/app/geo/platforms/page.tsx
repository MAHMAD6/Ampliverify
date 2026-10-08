import { Layers } from 'lucide-react';
import { Badge } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable, geoPeriod, loadGeo, pct } from '@/components/app/geo/GeoShell';
import { formatDateTime } from '@/lib/format';
import s from '@/components/app/geo/geo.module.css';

export const metadata = { title: 'Platforms · AI Search (GEO)' };

/** One row per platform in the GEO registry with this period's results. */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = geoPeriod((await searchParams).period);
  const { overview, platforms } = await loadGeo(period);
  const rows = overview?.platforms ?? platforms.map((p) => ({ ...p, answers: 0, citations: 0, lastCheckedAt: null, visibility: null, citationRate: null, avgPosition: null, shareOfVoice: null }));
  return (
    <GeoShell tab="platforms" period={period}>
      <GeoTable
        columns={['Platform', 'Answers Checked', 'Visibility Score', 'Citation Rate', 'Citations', 'Avg. Position', 'Share of Voice', 'Last Checked']}
        rows={rows.map((p) => [
          <span key="p" className={s.platform}>
            <span className={s.mono}>{p.name.charAt(0)}</span>
            {p.name} {!p.configured && <Badge tone="amber">Unavailable</Badge>}
          </span>,
          p.answers,
          pct(p.visibility),
          pct(p.citationRate),
          p.citations,
          p.avgPosition ?? '—',
          pct(p.shareOfVoice),
          p.lastCheckedAt ? formatDateTime(p.lastCheckedAt) : '—',
        ])}
        empty={<StateView kind="empty" compact icon={<Layers size={28} />} title="No platforms available" description="AI search platforms will be listed here once they are enabled." />}
      />
    </GeoShell>
  );
}
