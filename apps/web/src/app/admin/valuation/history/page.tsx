import Link from 'next/link';
import { Notice, Panel } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import type { HistoryRow } from '@/components/admin/valuation/types';
import s from '@/components/admin/valuation/valuation-admin.module.css';

export const metadata = { title: 'Calculation History' };

const money = (n: number | null, c: string) => (n === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n));
const field = { height: 38, border: '1px solid var(--line-strong)', borderRadius: 8, padding: '0 10px', font: 'inherit' } as const;

export default async function ValuationHistoryPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string; domain?: string }> }) {
  const { kind = '', status = '', domain = '' } = await searchParams;
  const q = new URLSearchParams(Object.entries({ kind, status, domain }).filter(([, v]) => v)).toString();
  const rows = await adminGet<HistoryRow[]>(`/admin/valuation/history${q ? `?${q}` : ''}`);
  return (
    <>
      <AdminHeader section="Website Value Calculator" title="Calculation History" description="Every estimate, enhanced valuation and test calculation, newest first." />
      <Panel>
        <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input name="domain" defaultValue={domain} placeholder="Filter by domain" aria-label="Domain" style={field} />
          <select name="kind" defaultValue={kind} aria-label="Type" style={field}>
            <option value="">All types</option>
            <option value="ESTIMATE">Estimates</option>
            <option value="VERIFIED">Enhanced</option>
            <option value="TEST">Tests</option>
          </select>
          <select name="status" defaultValue={status} aria-label="Status" style={field}>
            <option value="">All statuses</option>
            {['QUEUED', 'COLLECTING', 'NORMALIZING', 'CALCULATING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].map((x) => (
              <option key={x} value={x}>
                {x.charAt(0) + x.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <button type="submit" style={{ ...field, border: 0, background: 'var(--blue)', color: '#fff', fontWeight: 700, padding: '0 16px' }}>
            Filter
          </button>
        </form>
        {!rows ? (
          <Notice tone="neutral">History could not be loaded with your permissions.</Notice>
        ) : rows.length === 0 ? (
          <p className={s.hint}>No calculations match these filters.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Domain</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Value range</th>
                  <th>Confidence</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Requested by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.createdAt)}</td>
                    <td>
                      <Link href={`/admin/valuation/history/${r.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                        {r.domain}
                      </Link>
                    </td>
                    <td>{r.kind === 'VERIFIED' ? 'Enhanced' : r.kind === 'ESTIMATE' ? 'Estimate' : 'Test'}</td>
                    <td>{r.qualityScore ?? '—'}</td>
                    <td>{r.valueLow === null ? 'Insufficient evidence' : `${money(r.valueLow, r.currency)} – ${money(r.valueHigh, r.currency)}`}</td>
                    <td>{r.confidence ?? '—'}</td>
                    <td>{r.methodologyVersion ?? '—'}</td>
                    <td>
                      <span className={`${s.badge} ${r.status === 'FAILED' ? s.red : r.status === 'CANCELLED' || r.status === 'EXPIRED' ? s.amber : r.status === 'COMPLETED' ? '' : s.gray}`} title={r.error ?? undefined}>
                        {r.status.toLowerCase()}
                      </span>
                    </td>
                    <td>{r.user ?? (r.kind === 'ESTIMATE' ? 'Visitor' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
