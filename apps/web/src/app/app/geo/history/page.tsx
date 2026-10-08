import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { AutoRefresh } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable, geoPeriod, loadGeo } from '@/components/app/geo/GeoShell';
import { TrendChart } from '@/components/app/geo/TrendChart';
import { apiGet } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import s from '@/components/app/geo/geo.module.css';

export const metadata = { title: 'Visibility Trends · AI Search (GEO)' };

type Run = {
  id: string;
  prompt: { id: string; prompt: string };
  status: string;
  trigger: string;
  startedAt: string;
  completedAt: string | null;
  creditCost: string | null;
  platforms: { key: string; name: string; status: string; mentioned: boolean }[];
};

/** Visibility Trends tab = the page map's History (`geo_runs`, `geo_visibility_snapshots`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = geoPeriod((await searchParams).period);
  const { project, overview, platforms } = await loadGeo(period);
  const res = project ? await apiGet<Run[]>(`/user/projects/${project.id}/geo/history`, { auth: true }) : null;
  const runs = res?.ok ? res.data : [];
  const series = platforms
    .map((p) => ({ name: p.name, points: (overview?.trend ?? []).filter((t) => t.platformKey === p.key).map((t) => ({ at: t.day, value: t.visibility })) }))
    .filter((x) => x.points.length >= 2);
  return (
    <GeoShell tab="trends" period={period}>
      <AutoRefresh active={runs.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING')} />
      {series.length ? (
        <TrendChart series={series} />
      ) : (
        <StateView kind="empty" compact icon={<TrendingUp size={28} />} title="No visibility trend yet" description="Trends appear once prompts have been checked on at least two different days in this period." />
      )}
      <GeoTable
        columns={['Prompt', 'Platforms', 'Visibility', 'Trigger', 'Started', 'Status', 'Credits Used']}
        rows={runs.map((r) => {
          const ok = r.platforms.filter((p) => p.status === 'SUCCEEDED');
          return [
            <Link key="p" className={s.promptLink} href={`/app/geo/prompts/${r.prompt.id}`}>
              {r.prompt.prompt}
            </Link>,
            <span key="pl" className={s.chips}>
              {r.platforms.map((p) => (
                <span key={p.key} className={s.chip} data-on={p.mentioned} data-state={p.status === 'FAILED' ? 'fail' : undefined}>
                  {p.name}
                </span>
              ))}
            </span>,
            ok.length ? `${Math.round((ok.filter((p) => p.mentioned).length / ok.length) * 100)}%` : '—',
            humanize(r.trigger),
            formatDateTime(r.startedAt),
            humanize(r.status),
            r.creditCost === null ? '—' : Number(r.creditCost).toLocaleString('en-US'),
          ];
        })}
        empty={<StateView kind="empty" compact icon={<TrendingUp size={28} />} title="No checks yet" description="Run a prompt check to start building visibility history." />}
      />
    </GeoShell>
  );
}
