import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calculator, Gauge, Scale } from 'lucide-react';
import { ButtonLink, DataTable, Grid, KeyValue, Metric, Notice, PageHeader, Panel } from '@/components/ui';
import { ActionButton, AutoRefresh } from '@/components/ui/actions';
import { AssetsError } from '@/components/app/assets/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { assetLabel, money as minorMoney } from '@/lib/marketplace';
import { appCrumbs } from '@/lib/nav';
import { CLASS_LABEL, displayValue, type EvidenceRow, money, reportHref, RUNNING, STATUS_LABEL, type ValuationReport } from '@/lib/valuation';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Acquisition Analysis · Digital Assets' };

type Analysis = { id: string; url: string; domain: string; assetType: string; checks: string[]; askingPriceMinor: number | null; currency: string; notes: string | null; assetId: string | null; createdAt: string; valuation: ValuationReport | null; evidence: EvidenceRow[] };

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<Analysis>(`/user/assets/acquisitions/${id}`, { auth: true });
  if (!res.ok) return res.reason === 'not_found' || res.reason === 'forbidden' ? notFound() : <AssetsError />;
  const a = res.data;
  const v = a.valuation;
  const running = !!v && RUNNING.includes(v.status);
  const r = v?.monetaryRange;
  const asking = a.askingPriceMinor !== null ? a.askingPriceMinor / 100 : null;
  const verdict = r && asking !== null ? (asking < r.low ? 'below' : asking > r.high ? 'above' : 'within') : null;
  return (
    <>
      <AutoRefresh active={running} seconds={5} />
      <PageHeader
        title={a.domain}
        description={`${assetLabel(a.assetType)} · analysed ${formatDateTime(a.createdAt)}`}
        crumbs={appCrumbs({ label: 'Digital Assets', href: '/app/assets' }, { label: 'Acquisition Analyzer', href: '/app/assets/acquisitions' }, { label: a.domain })}
        actions={
          a.assetId ? (
            <ButtonLink href={`/app/assets/${a.assetId}`} variant="outline">
              View prospect
            </ButtonLink>
          ) : (
            <ActionButton path={`/user/assets/acquisitions/${a.id}/save`} redirectTo="/app/assets/{assetId}" successMessage="Saved as a prospective acquisition.">
              Save as prospective acquisition
            </ActionButton>
          )
        }
      />
      {!v ? (
        <Notice tone="amber" title="The analysis could not run.">
          Try again from the Acquisition Analyzer.
        </Notice>
      ) : running ? (
        <Notice tone="blue" title={`${STATUS_LABEL[v.status]}…`}>
          Collecting evidence for {a.domain}. This page updates automatically.
        </Notice>
      ) : v.status !== 'completed' ? (
        <Notice tone="amber" title={STATUS_LABEL[v.status]}>
          {v.error ?? 'The analysis did not complete.'}
        </Notice>
      ) : (
        <div className={m.stack}>
          <Grid cols={3}>
            <Metric label="Estimated value range" value={r ? `${money(r.low, r.currency)} – ${money(r.high, r.currency)}` : '—'} note={v.confidence ? `${v.confidence.toLowerCase()} confidence` : 'Not enough evidence for a range'} icon={<Calculator size={22} />} tone="purple" />
            <Metric label="Quality score" value={v.qualityScore ?? '—'} note={v.evidenceCoveragePct !== null ? `${v.evidenceCoveragePct}% evidence coverage` : undefined} icon={<Gauge size={22} />} tone="blue" />
            <Metric label="Asking price" value={minorMoney(a.askingPriceMinor, a.currency)} note={verdict ? `${verdict} the estimated range` : 'No asking price entered'} icon={<Scale size={22} />} tone={verdict === 'above' ? 'amber' : 'green'} />
          </Grid>
          <div className={m.two}>
            <Panel title="Evidence" bodyless>
              <DataTable
                columns={['Metric', 'Value', 'Source', 'Type']}
                rows={a.evidence.filter((e) => e.status === 'available').map((e) => [e.label, displayValue(e), e.sourceLabel, CLASS_LABEL[e.classification]])}
                empty="No evidence was available."
              />
            </Panel>
            <div className={m.stack}>
              {v.strengths.length > 0 && (
                <Panel title="Strengths">
                  <ul className={m.list}>
                    {v.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Panel>
              )}
              {v.improvements.length > 0 && (
                <Panel title="Risks and improvements">
                  <ul className={m.list}>
                    {v.improvements.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Panel>
              )}
              {v.limitations.length > 0 && (
                <Panel title="Limitations">
                  <ul className={m.list}>
                    {v.limitations.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Panel>
              )}
              <Panel title="Full report">
                <KeyValue label="Methodology" value={v.methodologyVersion ?? '—'} />
                <p className={m.muted}>{v.disclaimer}</p>
                <Link href={reportHref(v.id, v.shareToken)}>Open the full valuation report</Link>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
