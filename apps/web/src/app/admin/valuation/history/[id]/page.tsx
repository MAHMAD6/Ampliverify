import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notice, Panel } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { CLASS_LABEL, displayValue, money, reportHref, RUNNING, STATUS_LABEL, type EvidenceRow, type ValuationReport } from '@/lib/valuation';
import s from '@/components/admin/valuation/valuation-admin.module.css';

export const metadata = { title: 'Valuation Detail' };

type Detail = Omit<ValuationReport, 'owner' | 'verifiedChild' | 'enhancedCredits' | 'consentVersion' | 'disclaimer'> & { evidence: EvidenceRow[] };

/** Admin view of one calculation (always full detail, including test runs and every evidence row). */
export default async function ValuationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await adminGet<Detail>(`/admin/valuation/valuations/${id}`);
  if (!v) return <Notice tone="neutral">This valuation could not be loaded.</Notice>;
  const mode = v.mode === 'enhanced' ? 'Enhanced' : v.mode === 'test' ? 'Test' : 'Estimate';
  const done = v.status === 'completed' || v.status === 'expired';
  return (
    <>
      <AdminHeader section="Website Value Calculator" parent={{ label: 'Calculation History', href: '/admin/valuation/history' }} page={v.domain} title={`Valuation · ${v.domain}`} description={`${mode} · ${formatDateTime(v.createdAt)} · ${STATUS_LABEL[v.status]} · methodology ${v.methodologyVersion ?? '—'}`} />
      {v.mode !== 'test' && (
        <p style={{ marginBottom: 14 }}>
          <Link href={reportHref(v.id, v.shareToken)} style={{ color: 'var(--blue)', fontWeight: 600 }}>
            Open the report page →
          </Link>
        </p>
      )}
      {!done ? (
        <Panel>{v.status === 'failed' || v.status === 'cancelled' ? <Notice tone="amber">{v.error ?? STATUS_LABEL[v.status]}</Notice> : <p className={s.hint}>{RUNNING.includes(v.status) ? `${STATUS_LABEL[v.status]}… refresh in a moment.` : STATUS_LABEL[v.status]}</p>}</Panel>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className={s.stats}>
            <div>
              <b>{v.qualityScore ?? '—'}</b>
              <small>Quality score (0–100)</small>
            </div>
            <div>
              <b>{v.confidence ?? 'LOW'}</b>
              <small>Confidence · coverage {v.evidenceCoveragePct ?? 0}%</small>
            </div>
            <div>
              <b style={{ fontSize: v.monetaryRange ? 20 : 15 }}>{v.monetaryRange ? `${money(v.monetaryRange.low, v.monetaryRange.currency)} – ${money(v.monetaryRange.high, v.monetaryRange.currency)}` : 'Insufficient evidence'}</b>
              <small>{v.monetaryRange ? `${money(v.monetaryRange.earnings, v.monetaryRange.currency)} × ${v.monetaryRange.multipleLow}–${v.monetaryRange.multipleHigh}${v.monetaryRange.riskAdjusted ? ' · risk-adjusted' : ''}` : 'No monetary range'}</small>
            </div>
            <div>
              <b>{v.evidence.filter((e) => e.status === 'available').length}</b>
              <small>of {v.evidence.length} signals available</small>
            </div>
          </div>
          <div className={s.two}>
            <Panel title="Score Breakdown">
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Weight</th>
                    <th>Score</th>
                    <th>Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {(v.breakdown ?? []).map((b) => (
                    <tr key={b.category}>
                      <td>{b.label}</td>
                      <td>{b.weight}%</td>
                      <td>{b.score === null ? 'No data' : b.score}</td>
                      <td>{b.contributionPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Limitations">
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                {v.limitations.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p className={s.hint} style={{ marginTop: 10 }}>
                As of {v.asOf ? formatDateTime(v.asOf) : '—'} · expires {v.expiresAt ? formatDateTime(v.expiresAt) : '—'}
              </p>
            </Panel>
          </div>
          <Panel title="Evidence">
            <div style={{ overflowX: 'auto' }}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Signal</th>
                    <th>Value</th>
                    <th>Provenance</th>
                    <th>Observed</th>
                  </tr>
                </thead>
                <tbody>
                  {v.evidence.map((e) => (
                    <tr key={`${e.source}.${e.metric}`}>
                      <td>{e.sourceLabel}</td>
                      <td>
                        {e.label}
                        <span className={s.hint} style={{ display: 'block' }}>
                          {e.metric}
                        </span>
                      </td>
                      <td>{e.status === 'unavailable' ? <span className={`${s.badge} ${s.gray}`}>Unavailable{e.missingReason ? ` — ${e.missingReason}` : ''}</span> : displayValue(e)}</td>
                      <td>
                        <span className={`${s.badge} ${e.classification === 'self_reported' ? s.amber : e.classification === 'verified' ? '' : s.gray}`}>{CLASS_LABEL[e.classification]}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.observedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
