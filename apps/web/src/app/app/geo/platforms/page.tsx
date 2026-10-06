import { GeoShell } from '@/components/app/geo/GeoShell';
import { StateView } from '@/components/ui/StateView';
import { Layers } from 'lucide-react';
import { apiList } from '@/lib/api';
import s from '@/components/app/geo/geo.module.css';

export const metadata = { title: 'Platforms · AI Search (GEO)' };

/** One row per active platform in the GEO registry; per-platform results need the GEO API, so values read "—". */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [{ period = '30d' }, platforms] = await Promise.all([searchParams, apiList<{ key: string; name: string }>('/public/geo-platforms')]);
  const columns = ['Platform', 'Prompts Tracked', 'Visibility Score', 'Citations', 'Top Source', 'Last Checked'];
  return (
    <GeoShell tab="platforms" period={period}>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((p) => (
              <tr key={p.key}>
                <td>
                  <span className={s.platform}>
                    <span className={s.mono}>{p.name.charAt(0)}</span>
                    {p.name}
                  </span>
                </td>
                {columns.slice(1).map((c) => (
                  <td key={c}>—</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {platforms.length === 0 && <StateView kind="empty" compact icon={<Layers size={28} />} title="No platforms available" description="AI search platforms will be listed here once they are enabled." />}
      </div>
    </GeoShell>
  );
}
