import { Notice, Panel } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { adminGet } from '@/lib/admin-data';

export const metadata = { title: 'Revenue & Provider Cost' };

type Row = { plan: string; workspaces?: number; workspace?: string; revenueMinor: number; providerCostMinor: number; creditsConsumed: number; marginMinor: number };
type Margin = { month: string; currency: string; plans: Row[]; workspaces: (Row & { workspaceId: string })[]; unattributedProviderCostMinor: number; providers: { provider: string; spendUsd: number; ceilingUsd: number | null; pct: number | null }[] };

const usd = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const cell = { padding: '8px 10px', borderBottom: '1px solid var(--line)', fontSize: 14, textAlign: 'left' as const };

/** Revenue, provider cost, credits consumed and contribution margin by plan and workspace (Hybrid pricing §7). */
export default async function MarginPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const data = await adminGet<Margin>(`/admin/billing/margin${month && /^\d{4}-\d{2}$/.test(month) ? `?month=${month}` : ''}`);
  const table = (rows: Row[], first: 'plan' | 'workspace') => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {[first === 'plan' ? 'Plan' : 'Workspace', 'Revenue', 'Provider cost', 'Credits consumed', 'Margin'].map((h) => (
              <th key={h} style={{ ...cell, fontWeight: 700 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={cell}>{first === 'plan' ? `${r.plan}${r.workspaces ? ` (${r.workspaces})` : ''}` : `${r.workspace} · ${r.plan ?? 'no plan'}`}</td>
              <td style={cell}>{usd(r.revenueMinor)}</td>
              <td style={cell}>{usd(r.providerCostMinor)}</td>
              <td style={cell}>{r.creditsConsumed.toLocaleString('en-US')}</td>
              <td style={{ ...cell, color: r.marginMinor < 0 ? 'var(--red)' : undefined, fontWeight: 600 }}>{usd(r.marginMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <AdminHeader section="Billing" title="Revenue & Provider Cost" description="Paid invoices and credit purchases against recorded DataForSEO / OpenAI cost and credits consumed." />
      <form style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input type="month" name="month" defaultValue={data?.month} aria-label="Month" style={{ height: 38, border: '1px solid var(--line-strong)', borderRadius: 8, padding: '0 10px', font: 'inherit' }} />
        <button type="submit" style={{ height: 38, border: 0, borderRadius: 8, background: 'var(--blue)', color: '#fff', fontWeight: 700, padding: '0 16px' }}>
          Show
        </button>
      </form>
      {!data ? (
        <Notice tone="neutral">The report could not be loaded with your permissions.</Notice>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Provider spend this month" description="Month-to-date recorded cost against the ceilings set in Settings → Credits & Billing.">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {data.providers.map((p) => (
                <div key={p.provider}>
                  <b style={{ fontSize: 20 }}>${p.spendUsd.toFixed(2)}</b>
                  <small style={{ display: 'block', color: p.pct !== null && p.pct >= 80 ? 'var(--red)' : 'var(--muted)' }}>
                    {p.provider} {p.ceilingUsd ? `· ${p.pct}% of $${p.ceilingUsd}` : '· no ceiling'}
                  </small>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={`By plan · ${data.month}`}>{data.plans.length ? table(data.plans, 'plan') : <p style={{ color: 'var(--muted)' }}>No revenue or usage recorded for this month.</p>}</Panel>
          <Panel title="By workspace (lowest margin first)">{data.workspaces.length ? table(data.workspaces, 'workspace') : <p style={{ color: 'var(--muted)' }}>No workspaces with activity.</p>}</Panel>
          <Notice tone="neutral">Provider calls not linked to a workspace (for example the public Website Value Calculator) cost {usd(data.unattributedProviderCostMinor)} this month. OpenAI cost is estimated from tokens when token prices are set.</Notice>
        </div>
      )}
    </>
  );
}
