import { DataTable, PageHeader, Panel } from '@/components/ui';
import { AssetsError, assetLink, NoAssets, NoWorkspace } from '@/components/app/assets/parts';
import { apiGet } from '@/lib/api';
import { type AssetPerformance, range } from '@/lib/assets';
import { formatDate } from '@/lib/format';
import { money } from '@/lib/marketplace';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Performance & Reports · Digital Assets' };

function change(a: AssetPerformance) {
  const cur = a.latestValuation;
  const prev = a.previousValuation;
  if (!cur?.valueHigh || !prev?.valueHigh) return '—';
  const mid = (v: { valueLow: number | null; valueHigh: number | null }) => ((v.valueLow ?? 0) + (v.valueHigh ?? 0)) / 2;
  const pct = ((mid(cur) - mid(prev)) / Math.max(1, mid(prev))) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/** Value, financial and improvement performance per asset, from recorded data only. */
export default async function PerformancePage() {
  const { workspaceId } = await getAppContext();
  if (!workspaceId) return <NoWorkspace />;
  const res = await apiGet<AssetPerformance[]>(`/user/assets/performance?workspaceId=${workspaceId}`, { auth: true });
  if (!res.ok) return <AssetsError />;
  return (
    <>
      <PageHeader title="Performance & Reports" description="How each asset's value and earnings are moving. Valuations are estimates; financials are self-reported." crumbs={appCrumbs({ label: 'Digital Assets', href: '/app/assets' }, { label: 'Performance & Reports' })} />
      {res.data.length === 0 ? (
        <NoAssets />
      ) : (
        <div className={m.stack}>
          <Panel title="Valuation" bodyless>
            <DataTable
              columns={['Asset', 'Latest range', 'Quality', 'Change', 'Valuations', 'Last valued']}
              rows={res.data.map((a) => [assetLink(a), range(a.latestValuation), a.latestValuation?.qualityScore ?? '—', change(a), a.valuationCount, formatDate(a.latestValuation?.completedAt)])}
            />
          </Panel>
          <Panel title="Earnings (last 12 recorded months)" bodyless>
            <DataTable
              columns={['Asset', 'Months', 'Revenue', 'Costs', 'Profit', 'Source']}
              rows={res.data.map((a) => [assetLink(a), a.last12Months?.months ?? 0, money(a.last12Months?.revenueMinor, a.currency), money(a.last12Months?.costMinor, a.currency), money(a.last12Months?.profitMinor, a.currency), a.last12Months ? 'Self-reported' : '—'])}
            />
          </Panel>
          <p className={m.muted}>Need a shareable report? Generate one for the linked project from Reports.</p>
        </div>
      )}
    </>
  );
}
