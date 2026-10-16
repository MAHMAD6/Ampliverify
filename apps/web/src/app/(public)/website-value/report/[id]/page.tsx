import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowRight, BarChart3, Check, Database, Download, ExternalLink, FileText, Gauge as GaugeIcon, Globe, Info, Lightbulb, RefreshCw, Scale, Search, Settings2, ShieldCheck, Target, X } from 'lucide-react';
import { AutoRefresh } from '@/components/public/valuation/AutoRefresh';
import { CancelButton } from '@/components/public/valuation/CancelButton';
import { DONUT_COLORS, Donut, Gauge, LineChart } from '@/components/public/valuation/Charts';
import { apiGet } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { CLASS_LABEL, compact, displayValue, money, reportHref, RUNNING, STATUS_LABEL, type EvidenceRow, type ValuationReport } from '@/lib/valuation';
import { formatDate } from '@/lib/format';
import site from '@/components/public/site.module.css';
import s from '@/components/public/valuation/valuation.module.css';

export const metadata = { title: 'Website Value Report', robots: { index: false } };

const TABS = [
  ['overview', 'Overview'],
  ['breakdown', 'Score Breakdown'],
  ['evidence', 'Evidence'],
  ['methodology', 'Methodology'],
] as const;

const CAT_ICON: Record<string, React.ReactNode> = {
  visibility: <Search size={18} />,
  technical: <Settings2 size={18} />,
  performance: <GaugeIcon size={18} />,
  content: <FileText size={18} />,
  risk: <ShieldCheck size={18} />,
};

function Panel({ icon, title, children, tone, action }: { icon: React.ReactNode; title: string; children: React.ReactNode; tone?: 'amber'; action?: React.ReactNode }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <h3>
          <span className={`${s.ico} ${tone === 'amber' ? s.amber : ''}`}>{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListPanel({ icon, title, items, tone, numbered, empty = 'None identified.' }: { icon: React.ReactNode; title: string; items: string[]; tone?: 'amber'; numbered?: boolean; empty?: string }) {
  return (
    <Panel icon={icon} title={title} tone={tone}>
      {items.length ? (
        <ul className={s.list}>
          {items.map((t, i) => (
            <li key={t}>
              {numbered ? <span className={s.num}>{i + 1}</span> : tone === 'amber' ? <AlertTriangle size={18} className={s.warnIcon} /> : <Check size={18} className={s.okIcon} />}
              {t}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 14, color: 'var(--mute)' }}>{empty}</p>
      )}
    </Panel>
  );
}

function BreakdownPanel({ v }: { v: ValuationReport }) {
  const rows = v.breakdown ?? [];
  const parts = rows.filter((b) => b.contributionPct > 0);
  return (
    <Panel icon={<BarChart3 size={18} />} title="Quality Score Breakdown">
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <Donut parts={parts.map((b) => ({ label: b.label, value: b.contributionPct }))} center={v.qualityScore === null ? '—' : String(v.qualityScore)} sub="Quality score" />
        <div className={s.legend}>
          {rows.map((b, i) => (
            <div key={b.category}>
              <i style={{ background: b.score === null ? '#cfd8de' : DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span>
                {b.label} <small style={{ color: 'var(--mute)' }}>· weight {b.weight}%</small>
              </span>
              <b>{b.score === null ? 'No data' : `${b.score}/100`}</b>
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 14 }}>Categories without evidence are excluded and the remaining weights are renormalized — missing data is never scored as zero.</p>
    </Panel>
  );
}

function CategoryCards({ v }: { v: ValuationReport }) {
  return (
    <div className={`${s.tiles} ${s.tiles5}`}>
      {(v.breakdown ?? []).map((b) => (
        <div key={b.category} className={s.tile}>
          <small style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700, color: 'var(--navy)' }}>
            <span className={s.ico} style={{ width: 28, height: 28 }}>
              {CAT_ICON[b.category]}
            </span>
            {b.label}
          </small>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <b>{b.score === null ? '—' : b.score}</b>
              <small style={{ display: 'block' }}>{b.score === null ? 'not enough evidence' : `of 100 · weight ${b.weight}%`}</small>
            </div>
            {b.score !== null && <Gauge value={b.score} size={58} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  const sources = Array.from(new Set(rows.map((r) => r.sourceLabel)));
  if (!rows.length) return <p style={{ fontSize: 14, color: 'var(--mute)' }}>No evidence was recorded.</p>;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {sources.map((src) => (
        <div key={src}>
          <div className={s.subhead}>{src}</div>
          <div className={s.evTable} role="table" aria-label={`${src} evidence`}>
            <div role="row" className={s.evHead}>
              <span role="columnheader">Signal</span>
              <span role="columnheader">Value</span>
              <span role="columnheader">Provenance</span>
              <span role="columnheader">Observed</span>
            </div>
            {rows
              .filter((r) => r.sourceLabel === src)
              .map((r) => (
                <div role="row" key={r.metric} className={r.status === 'unavailable' ? s.evMissing : undefined}>
                  <span role="cell">{r.label}</span>
                  <span role="cell">{r.status === 'unavailable' ? <em title={r.missingReason ?? undefined}>Unavailable{r.missingReason ? ` — ${r.missingReason}` : ''}</em> : displayValue(r)}</span>
                  <span role="cell">
                    <span className={`${s.pill} ${r.classification === 'verified' ? '' : r.classification === 'self_reported' ? s.amber : r.classification === 'modeled' ? s.soft : s.gray}`}>{CLASS_LABEL[r.classification]}</span>
                  </span>
                  <span role="cell">
                    {formatDate(r.observedAt)}
                    {r.periodStart && r.periodEnd && <small style={{ display: 'block' }}>{`${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}`}</small>}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Methodology({ v }: { v: ValuationReport }) {
  return (
    <Panel icon={<Scale size={18} />} title={`Methodology ${v.methodologyVersion ?? ''}`}>
      <div className={s.checkRows}>
        <div>
          <Check size={18} className={s.okIcon} />
          <span>
            Quality score (0–100)
            <small>Weighted average of search visibility, technical health, performance, content and risk / trust. Published weights: {(v.breakdown ?? []).map((b) => `${b.label} ${b.weight}%`).join(', ')}. Withheld if evidence coverage is below the minimum threshold.</small>
          </span>
        </div>
        <div>
          <Check size={18} className={s.okIcon} />
          <span>
            Monetary range
            <small>Trailing-twelve-month owner earnings × dated comparable sale multiples for the same business model, maintained by our analysts. A documented risk discount applies to low quality scores. Without both inputs no dollar figure is shown.</small>
          </span>
        </div>
        <div>
          <Check size={18} className={s.okIcon} />
          <span>
            Confidence
            <small>LOW: public or modeled data only. MEDIUM: verified traffic (GA4 / Search Console), self-reported financials and current comparables. HIGH is not offered in this version.</small>
          </span>
        </div>
        <div>
          <Info size={18} className={s.warnIcon} />
          <span>
            Results are immutable
            <small>
              Calculated {formatDate(v.asOf ?? v.createdAt)} with methodology {v.methodologyVersion}. {v.expiresAt ? `This snapshot expires ${formatDate(v.expiresAt)}; run a new calculation for current data.` : ''}
            </small>
          </span>
        </div>
      </div>
    </Panel>
  );
}

async function load(id: string, t?: string) {
  const q = t && /^[\w-]{10,64}$/.test(t) ? `?t=${encodeURIComponent(t)}` : '';
  const signedIn = Boolean(await getAccessToken());
  const base = signedIn ? `/user/valuations/${id}` : `/public/valuations/${id}`;
  let report = await apiGet<ValuationReport>(`${base}${q}`, { auth: signedIn, revalidate: 0 });
  // A signed-in visitor opening someone else's shared link: fall back to the public route.
  if (signedIn && !report.ok && report.reason === 'not_found' && q) report = await apiGet<ValuationReport>(`/public/valuations/${id}${q}`, { revalidate: 0 });
  const evidence = report.ok && report.data.status === 'completed' ? await apiGet<EvidenceRow[]>(`${report.data.owner && signedIn ? `/user/valuations/${id}` : `/public/valuations/${id}`}/evidence${q}`, { auth: report.data.owner && signedIn, revalidate: 0 }) : null;
  return { report, evidence: evidence?.ok ? evidence.data : [] };
}

export default async function ValuationReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; t?: string }> }) {
  const { id } = await params;
  const { tab: tabParam, t } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { report, evidence } = await load(id, t);
  if (!report.ok && report.reason === 'not_found') notFound();
  const v = report.ok ? report.data : null;
  const tab = TABS.some(([k]) => k === tabParam) ? tabParam! : 'overview';
  const token = v?.shareToken ?? t ?? '';
  const href = (k: string) => `${reportHref(id, token)}${k === 'overview' ? '' : `&tab=${k}`}`;
  const enhanceHref = v ? `/website-value/report/${v.mode === 'enhanced' && v.parentId ? v.parentId : id}/enhance?t=${encodeURIComponent(token)}` : '#';
  const done = v?.status === 'completed' || v?.status === 'expired';
  const trend = v?.trend ?? [];

  return (
    <div className={s.wrap}>
      <section style={{ background: 'linear-gradient(180deg,#f4faf6,#fff)', padding: '28px 0 8px' }}>
        <div className={site.container}>
          <nav className={site.crumbs} aria-label="Breadcrumb" style={{ color: 'var(--mute)' }}>
            <Link href="/">Home</Link> › <Link href="/blog">Resources</Link> › <Link href="/website-value">Website Value Calculator</Link> › <span>Report</span>
          </nav>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
            <div>
              <h1 className={site.h2} style={{ margin: '4px 0' }}>
                Website Value Report {v?.mode === 'enhanced' && <span className={s.pill}>Enhanced</span>}
              </h1>
              <p style={{ color: 'var(--ink2)' }}>An evidence-graded assessment of search visibility, technical health, performance, content and trust — with every signal’s source shown.</p>
            </div>
            <div className={s.reportActions}>
              <Link href="/website-value" className={`${site.btnOutline} ${site.sm}`}>
                <RefreshCw size={16} /> New Calculation
              </Link>
              {done ? (
                <a href={`/website-value/report/${id}/pdf?t=${encodeURIComponent(token)}`} className={`${site.btnOutline} ${site.sm}`}>
                  <Download size={16} /> Download PDF
                </a>
              ) : (
                <span className={`${site.btnOutline} ${site.sm}`} aria-disabled="true" style={{ opacity: 0.55, cursor: 'not-allowed' }}>
                  <Download size={16} /> Download PDF
                </span>
              )}
              {v?.status === 'completed' && (
                <Link href={enhanceHref} className={`${site.btn} ${site.sm}`}>
                  <BarChart3 size={16} /> Improve Accuracy
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className={site.container} style={{ display: 'grid', gap: 18, padding: '18px 0 56px' }}>
        {!v ? (
          <div className={s.panel}>The report could not be loaded. Please try again shortly.</div>
        ) : RUNNING.includes(v.status) ? (
          <div className={s.panel} style={{ textAlign: 'center', padding: 48 }}>
            <AutoRefresh />
            <RefreshCw size={30} color="#15803d" />
            <h2 style={{ margin: '12px 0 6px' }}>Analyzing {v.domain}…</h2>
            <ol className={s.stepper} aria-label="Progress">
              {(['queued', 'collecting', 'normalizing', 'calculating'] as const).map((st, i) => {
                const at = RUNNING.indexOf(v.status);
                return (
                  <li key={st} data-state={i < at ? 'done' : i === at ? 'active' : 'todo'}>
                    {STATUS_LABEL[st]}
                  </li>
                );
              })}
            </ol>
            <p style={{ color: 'var(--mute)' }}>We are crawling the site and collecting PageSpeed, domain and search data. This usually takes under a minute; this page updates automatically.</p>
            {v.status === 'queued' && <CancelButton id={id} token={token} />}
          </div>
        ) : v.status === 'failed' || v.status === 'cancelled' ? (
          <div className={s.panel} style={{ textAlign: 'center', padding: 40 }}>
            {v.status === 'cancelled' ? <X size={30} color="#64748b" /> : <AlertTriangle size={30} color="#d97706" />}
            <h2 style={{ margin: '12px 0 6px' }}>{v.status === 'cancelled' ? 'This calculation was cancelled' : `We couldn’t analyze ${v.domain}`}</h2>
            <p style={{ color: 'var(--mute)' }}>{v.status === 'cancelled' ? 'No credits were used.' : (v.error ?? 'Not enough data was available for this domain.')}</p>
            <Link href="/website-value" className={`${site.btn} ${site.sm}`} style={{ marginTop: 16 }}>
              Try Another Domain
            </Link>
          </div>
        ) : (
          <>
            {v.status === 'expired' && (
              <div className={s.banner}>
                <span>
                  <Info size={18} style={{ verticalAlign: 'middle' }} /> This snapshot from {formatDate(v.asOf ?? v.createdAt)} has expired. The results below are kept for reference only.
                </span>
                <Link href="/website-value" className={`${site.btn} ${site.sm}`}>
                  Run a New Calculation
                </Link>
              </div>
            )}
            {v.verifiedChild && (
              <div className={s.banner}>
                <span>
                  <ShieldCheck size={18} color="#15803d" style={{ verticalAlign: 'middle' }} /> {v.verifiedChild.status === 'completed' ? 'An enhanced valuation using your connected data is available.' : `Your enhanced valuation is ${STATUS_LABEL[v.verifiedChild.status].toLowerCase()}.`}
                </span>
                <Link href={reportHref(v.verifiedChild.id, v.verifiedChild.shareToken)} className={`${site.btn} ${site.sm}`}>
                  View Enhanced Valuation
                </Link>
              </div>
            )}
            <section className={s.panel}>
              <div className={s.reportTop}>
                {v.screenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={s.shot} src={v.screenshot} alt={`Screenshot of ${v.domain}`} />
                ) : (
                  <div className={s.shot}>
                    <Globe size={30} />
                  </div>
                )}
                <div>
                  <a className={s.domain} href={`https://${v.domain}`} target="_blank" rel="noopener noreferrer nofollow">
                    {v.domain} <ExternalLink size={16} />
                  </a>
                  <div className={s.metaLine}>
                    {v.mode === 'enhanced' ? 'Enhanced valuation' : 'Public-data estimate'} · As of {formatDate(v.asOf ?? v.createdAt)} · Methodology {v.methodologyVersion}
                  </div>
                  <p style={{ marginTop: 16, fontWeight: 700, fontSize: 18 }}>Estimated Website Value</p>
                  {v.monetaryRange ? (
                    <>
                      <div className={s.valueBig}>
                        {money(v.monetaryRange.low, v.monetaryRange.currency)} – {money(v.monetaryRange.high, v.monetaryRange.currency)}
                      </div>
                      <p style={{ marginTop: 6, fontSize: 14, color: 'var(--ink2)' }}>
                        {money(v.monetaryRange.earnings, v.monetaryRange.currency)} TTM earnings × {v.monetaryRange.multipleLow}–{v.monetaryRange.multipleHigh}× comparables{v.monetaryRange.riskAdjusted ? ' · risk-adjusted' : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className={s.noValue}>Insufficient evidence for a monetary valuation</div>
                      <p style={{ marginTop: 6, fontSize: 14, color: 'var(--ink2)' }}>A dollar range needs your trailing-twelve-month earnings and current comparable sales for your business model.</p>
                    </>
                  )}
                </div>
                <div className={s.confBox}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                    <b>Quality Score</b>
                    <span className={`${s.pill} ${v.confidence === 'MEDIUM' ? '' : s.amber}`}>{v.confidence ?? 'LOW'} confidence</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0' }}>
                    <span className={s.confPct}>{v.qualityScore ?? '—'}</span>
                    <div className={s.bar} style={{ flex: 1 }}>
                      <i style={{ width: `${v.qualityScore ?? 0}%` }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink2)', display: 'flex', gap: 6 }}>
                    <Info size={16} style={{ flex: 'none', marginTop: 1 }} />
                    Evidence coverage {v.evidenceCoveragePct ?? 0}%. {v.confidence === 'MEDIUM' ? 'Uses verified traffic and your financials.' : 'Connect GA4 or Search Console and add your earnings to raise confidence.'}
                  </p>
                </div>
              </div>
            </section>

            <CategoryCards v={v} />

            <nav className={s.tabs} aria-label="Report sections">
              {TABS.map(([k, l]) => (
                <Link key={k} href={href(k)} aria-current={tab === k ? 'page' : undefined} scroll={false}>
                  {l}
                </Link>
              ))}
            </nav>

            {tab === 'overview' && (
              <>
                <div className={s.grid3}>
                  <BreakdownPanel v={v} />
                  <ListPanel icon={<Target size={18} />} title="Strengths" items={v.strengths} />
                  <ListPanel icon={<AlertTriangle size={18} />} title="Needs Improvement" items={v.improvements} tone="amber" />
                </div>
                <div className={trend.length ? s.grid2 : undefined}>
                  {trend.length > 0 && (
                    <Panel icon={<Search size={18} />} title="Estimated Organic Traffic">
                      <LineChart points={trend} label="Estimated organic traffic trend" />
                      <p style={{ fontSize: 12, color: 'var(--mute)' }}>Modeled estimate from DataForSEO, not measured visits.</p>
                    </Panel>
                  )}
                  <ListPanel icon={<Lightbulb size={18} />} title="Ways to Increase Website Value" items={v.opportunities} numbered />
                </div>
                <ListPanel icon={<Info size={18} />} title="Limitations" items={v.limitations} tone="amber" empty="No limitations recorded." />
              </>
            )}
            {tab === 'breakdown' && (
              <div className={s.grid2}>
                <BreakdownPanel v={v} />
                <Panel icon={<BarChart3 size={18} />} title="Contribution to Score">
                  {(v.breakdown ?? []).map((b) => (
                    <div key={b.category} className={s.breakRow}>
                      <span>{b.label}</span>
                      <div className={s.bar}>
                        <i style={{ width: `${b.score ?? 0}%` }} />
                      </div>
                      <span>{b.score === null ? '—' : b.score}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 10 }}>Evidence coverage: {v.evidenceCoveragePct ?? 0}% of the weighted categories.</p>
                </Panel>
              </div>
            )}
            {tab === 'evidence' && (
              <Panel icon={<Database size={18} />} title="Evidence & Provenance">
                <EvidenceTable rows={evidence} />
              </Panel>
            )}
            {tab === 'methodology' && (
              <div className={s.grid2}>
                <Methodology v={v} />
                <ListPanel icon={<Info size={18} />} title="Limitations" items={v.limitations} tone="amber" empty="No limitations recorded." />
              </div>
            )}

            {v.mode !== 'enhanced' && v.status === 'completed' && (
              <div className={s.banner}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span className={s.ico} style={{ width: 48, height: 48, flex: 'none' }}>
                    <Target size={24} />
                  </span>
                  <div>
                    <h3 style={{ margin: 0 }}>Get a More Accurate Valuation</h3>
                    <p style={{ fontSize: 14, color: 'var(--ink2)' }}>Connect Google Analytics and Search Console and add your earnings for an enhanced valuation with a dollar range and higher confidence.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href={enhanceHref} className={`${site.btn} ${site.sm}`}>
                    Improve Valuation Accuracy <ArrowRight size={16} />
                  </Link>
                  <Link href={`/signup?website=${encodeURIComponent(v.domain)}`} className={`${site.btnOutline} ${site.sm}`}>
                    Run Full SEO Audit <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--mute)' }}>
              {v.disclaimer} {compact(evidence.length)} signals recorded.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
