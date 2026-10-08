import Link from 'next/link';
import { BarChart3, Box, Coins, DollarSign } from 'lucide-react';
import { AdminList } from '@/components/admin/AdminList';
import { adminGet, dateTime } from '@/lib/admin-data';
import { featureLabel, formatMoney } from '@/lib/format';

export const metadata = { title: 'Usage & Costs' };

type Usage = {
  since: string;
  byFeature: { featureKey: string; units: number; events: number }[];
  byProvider: { provider: string; operation: string; currency: string | null; costMinor: string; inputUnits: number; outputUnits: number; calls: number }[];
  daily: { day: string; units: number }[];
  topWorkspaces: { workspaceId: string; name: string | null; units: number }[];
  credits: { reason: string; delta: number }[];
};

const PERIODS = [
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['365', 'Last 12 months'],
] as const;

/**
 * Usage & Costs (chat design 2026-10-06): metered usage (`usage_events`),
 * provider calls and recorded costs (`provider_usage`) and credit movements.
 * Estimates for operations, not invoices.
 */
export default async function UsageCostsPage({ searchParams }: { searchParams: Promise<{ tab?: string; days?: string }> }) {
  const { tab = 'module', days: d = '30' } = await searchParams;
  const days = PERIODS.some(([v]) => v === d) ? d : '30';
  const u = await adminGet<Usage>(`/admin/usage?days=${days}`);
  const costs = new Map<string, number>();
  for (const p of u?.byProvider ?? []) if (p.currency) costs.set(p.currency, (costs.get(p.currency) ?? 0) + Number(p.costMinor));
  const spent = (u?.credits ?? []).filter((c) => c.delta < 0).reduce((n, c) => n - c.delta, 0);
  const rows =
    tab === 'service'
      ? (u?.byProvider ?? []).map((p) => [p.provider, p.operation, `${p.calls.toLocaleString('en-US')} calls`, `${p.inputUnits.toLocaleString('en-US')} in / ${p.outputUnits.toLocaleString('en-US')} out`, p.currency ? formatMoney(p.costMinor, p.currency) : 'Not reported'])
      : tab === 'credits'
        ? (u?.credits ?? []).map((c) => [featureLabel(c.reason.toLowerCase()), c.delta > 0 ? 'Added' : 'Used', Math.abs(c.delta).toLocaleString('en-US'), '', ''])
        : tab === 'workspaces'
          ? (u?.topWorkspaces ?? []).map((w) => [w.name ?? w.workspaceId, 'Workspace', `${w.units.toLocaleString('en-US')} units`, '', <Link key="l" href={`/admin/search?q=${encodeURIComponent(w.name ?? '')}`} style={{ color: 'var(--blue)' }}>Find</Link>])
          : (u?.byFeature ?? []).map((f) => [featureLabel(f.featureKey), f.featureKey, `${f.units.toLocaleString('en-US')} units`, `${f.events.toLocaleString('en-US')} events`, '']);
  const columns =
    tab === 'service' ? ['Provider', 'Operation', 'Calls', 'Tokens / Units', 'Recorded Cost'] : tab === 'credits' ? ['Reason', 'Direction', 'Credits', '', ''] : tab === 'workspaces' ? ['Workspace', 'Type', 'Usage', '', ''] : ['Module / Feature', 'Key', 'Usage', 'Events', ''];

  return (
    <AdminList
      section="System Operations"
      title="Usage & Costs"
      description="Monitor platform usage and estimated costs across modules, services, and providers."
      about={{ title: 'About Usage & Costs', text: 'Estimated third-party costs (AI, keyword data) and metered usage for operational monitoring. These are not invoices. Workspace credit balances are under Billing & Access.' }}
      metrics={[
        { label: 'Total Usage', icon: <BarChart3 size={24} />, tone: 'blue', value: u ? u.byFeature.reduce((n, f) => n + f.units, 0).toLocaleString('en-US') : undefined, note: 'Metered units' },
        { label: 'Recorded Provider Cost', icon: <DollarSign size={24} />, tone: 'green', value: u ? ([...costs.entries()].map(([c, m]) => formatMoney(String(m), c)).join(' + ') || '—') : undefined, note: 'Where providers report cost' },
        { label: 'Credits Consumed', icon: <Coins size={24} />, tone: 'purple', value: u ? spent.toLocaleString('en-US') : undefined },
        { label: 'Active Services', icon: <Box size={24} />, tone: 'amber', value: u ? new Set(u.byProvider.map((p) => p.provider)).size : undefined, note: 'Providers called' },
      ]}
      tabs={[
        { key: 'module', label: 'By Module' },
        { key: 'service', label: 'By Service' },
        { key: 'workspaces', label: 'Top Workspaces' },
        { key: 'credits', label: 'Credits' },
      ]}
      activeTab={tab}
      basePath="/admin/usage"
      search="Search usage..."
      liveFilters={{}}
      selects={[{ label: 'Period', name: 'days', value: days, options: [['30', 'Last 30 days'], ...PERIODS.filter(([v]) => v !== '30').map(([v, l]) => [v, l] as [string, string])] }]}
      columns={columns}
      rows={rows}
      empty={{ icon: <BarChart3 size={40} />, title: u ? 'No usage in this period' : 'Usage unavailable', text: u ? 'Usage and cost data will appear here as the platform is used.' : 'Your account cannot read system data, or the API is unavailable.' }}
      footnote={u ? `Since ${dateTime(u.since)}. Estimated costs are for operational monitoring and are not invoices or billing charges.` : undefined}
    />
  );
}
