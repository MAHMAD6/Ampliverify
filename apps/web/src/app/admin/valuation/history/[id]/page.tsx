import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notice, Panel } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { compact, money, SOURCE_STATE_LABEL, type ValuationReport } from '@/lib/valuation';
import s from '@/components/admin/valuation/valuation-admin.module.css';

export const metadata = { title: 'Valuation Detail' };

/** Admin view of one calculation (always full detail, including test runs). */
export default async function ValuationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await adminGet<Omit<ValuationReport, 'kind'> & { kind: string }>(`/admin/valuation/valuations/${id}`);
  if (!v) return <Notice tone="neutral">This valuation could not be loaded.</Notice>;
  const r = v.result;
  const d = r?.detail;
  const kind = v.kind.charAt(0) + v.kind.slice(1).toLowerCase();
  return (
    <>
      <AdminHeader section="Website Value Calculator" parent={{ label: 'Calculation History', href: '/admin/valuation/history' }} page={v.domain} title={`Valuation · ${v.domain}`} description={`${kind} · ${formatDateTime(v.createdAt)} · ${v.status.toLowerCase()}`} />
      {v.kind !== 'TEST' && (
        <p style={{ marginBottom: 14 }}>
          <Link href={`/website-value/report/${v.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
            Open the public report →
          </Link>
        </p>
      )}
      {!r ? (
        <Panel>{v.status === 'FAILED' ? <Notice tone="amber">{v.error ?? 'The calculation failed.'}</Notice> : <p className={s.hint}>Still calculating. Refresh in a moment.</p>}</Panel>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className={s.stats}>
            <div>
              <b>
                {money(r.valueLow, r.currency)} – {money(r.valueHigh, r.currency)}
              </b>
              <small>Value range (midpoint {money(r.valueMid, r.currency)})</small>
            </div>
            <div>
              <b>{r.confidence}%</b>
              <small>Confidence · {r.confidenceLabel}</small>
            </div>
            <div>
              <b>{compact(r.metrics.organicTraffic)}</b>
              <small>Organic traffic / month</small>
            </div>
            <div>
              <b>{compact(r.metrics.referringDomains)}</b>
              <small>Referring domains</small>
            </div>
          </div>
          <div className={s.two}>
            <Panel title="Value Breakdown">
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th>Score</th>
                    <th>Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {(r.breakdown ?? []).map((b) => (
                    <tr key={b.factor}>
                      <td>{b.label}</td>
                      <td>{b.score === null ? 'No data' : b.score.toFixed(2)}</td>
                      <td>{b.contributionPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={s.hint} style={{ marginTop: 10 }}>
                Confidence parts: coverage {r.confidenceParts.coverage}%, reliability {r.confidenceParts.reliability}%, freshness {r.confidenceParts.freshness}%, consistency {r.confidenceParts.consistency}% · method: {r.method}
              </p>
            </Panel>
            <Panel title="Data Sources">
              {r.sources.map((x) => (
                <div key={x.key} className={s.row}>
                  <span>{x.label}</span>
                  <span className={`${s.badge} ${x.state === 'unavailable' ? s.amber : x.state === 'disabled' ? s.gray : ''}`}>{SOURCE_STATE_LABEL[x.state]}</span>
                </div>
              ))}
            </Panel>
          </div>
          <div className={s.two}>
            <Panel title="Drivers & Risks">
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                {r.drivers.map((x) => (
                  <li key={x}>{x}</li>
                ))}
                {r.risks.map((x) => (
                  <li key={x} style={{ color: 'var(--amber)' }}>
                    {x}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Technical & Domain">
              <p className={s.hint} style={{ fontSize: 14 }}>
                PageSpeed {d?.technical?.pagespeedMobile ?? '—'} (mobile) / {d?.technical?.pagespeedDesktop ?? '—'} (desktop) · Core Web Vitals {d?.technical?.coreWebVitals ?? '—'} · Domain age {d?.domain?.ageYears ?? '—'} years · Authority {d?.domain?.authority ?? '—'}/100
              </p>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
