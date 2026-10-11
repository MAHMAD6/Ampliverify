import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowRight, BarChart3, Check, Database, Download, ExternalLink, FileText, Globe, Info, Lightbulb, Link2, Lock, RefreshCw, Search, Settings2, ShieldCheck, Target, Users } from 'lucide-react';
import { AutoRefresh } from '@/components/public/valuation/AutoRefresh';
import { BarChart, DONUT_COLORS, Donut, LineChart, Sparkline } from '@/components/public/valuation/Charts';
import { apiGet } from '@/lib/api';
import { compact, money, SOURCE_STATE_LABEL, VALUATION_TABS, type ValuationReport } from '@/lib/valuation';
import { formatDate } from '@/lib/format';
import site from '@/components/public/site.module.css';
import s from '@/components/public/valuation/valuation.module.css';

export const metadata = { title: 'Website Value Report', robots: { index: false } };

type Result = NonNullable<ValuationReport['result']>;
type Detail = NonNullable<Result['detail']>;

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <small>&nbsp;</small>;
  return (
    <small>
      <span className={pct >= 0 ? s.up : s.down}>
        {pct >= 0 ? '↑' : '↓'} {pct >= 0 ? '+' : ''}
        {pct}%
      </span>{' '}
      vs. previous 6 months
    </small>
  );
}

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

const yes = (v: boolean | null, ok: string, bad: string, unknown = 'Not checked') => (v === null ? unknown : v ? ok : bad);

function TrafficPanel({ d }: { d: NonNullable<Detail['traffic']> }) {
  return (
    <Panel icon={<Search size={18} />} title="Traffic & Search Visibility">
      <div className={s.stats}>
        <div>
          <b>{compact(d.organicVisits)}</b>
          <small>Organic visits / month</small>
        </div>
        <div>
          <b>{compact(d.rankingKeywords)}</b>
          <small>Ranking keywords</small>
        </div>
        <div>
          <b>{d.avgPosition ?? '—'}</b>
          <small>Avg. position</small>
        </div>
      </div>
      <div className={s.subhead}>Organic Traffic Trend</div>
      <LineChart points={d.trend} label="Organic traffic trend" />
    </Panel>
  );
}

function BacklinksPanel({ d }: { d: NonNullable<Detail['backlinks']> }) {
  return (
    <Panel icon={<Link2 size={18} />} title="Backlink Profile">
      <div className={s.stats}>
        <div>
          <b>{compact(d.referringDomains)}</b>
          <small>Referring domains</small>
        </div>
        <div>
          <b>{compact(d.totalBacklinks)}</b>
          <small>Total backlinks</small>
        </div>
        <div>
          <b>{d.domainAuthority ?? '—'}</b>
          <small>Domain authority</small>
        </div>
      </div>
      <div className={s.subhead}>Referring Domains Trend</div>
      <BarChart points={d.trend} label="Referring domains trend" />
    </Panel>
  );
}

function SocialPanel({ d, id }: { d: NonNullable<Detail['social']>; id: string }) {
  return (
    <Panel icon={<Users size={18} />} title="Social & Referral Traffic">
      {d.verified ? (
        <>
          <div className={s.stats}>
            <div>
              <b>{compact(d.visits)}</b>
              <small>Social visits / month</small>
            </div>
            <div>
              <b>{d.share === null ? '—' : `${d.share}%`}</b>
              <small>Share of total traffic</small>
            </div>
            <div>
              <b>
                <ShieldCheck size={20} color="#15803d" />
              </b>
              <small>Verified via GA4</small>
            </div>
          </div>
          <div className={s.subhead}>Social Traffic Trend</div>
          <LineChart points={d.trend} label="Social traffic trend" />
          <div className={s.subhead} style={{ marginTop: 10 }}>
            Top Social Sources
          </div>
          {d.sources.length ? (
            d.sources.slice(0, 6).map((x) => (
              <div key={x.source} className={s.breakRow} style={{ gridTemplateColumns: 'minmax(0,140px) minmax(0,1fr) 44px' }}>
                <span>{x.source}</span>
                <div className={s.bar}>
                  <i style={{ width: `${x.share}%` }} />
                </div>
                <span>{x.share}%</span>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 13, color: 'var(--mute)' }}>No social sessions in the last 30 days.</p>
          )}
        </>
      ) : (
        <div className={s.locked}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>Social traffic is only available from your own analytics. Connect Google Analytics 4 to include it.</p>
          <Link href={`/website-value/report/${id}/enhance`} className={`${site.btnOutline} ${site.sm}`}>
            Connect GA4
          </Link>
        </div>
      )}
    </Panel>
  );
}

function ContentPanel({ d }: { d: NonNullable<Detail['content']> }) {
  return (
    <Panel icon={<FileText size={18} />} title="Content Value">
      <div className={s.stats}>
        <div>
          <b>{compact(d.pages)}</b>
          <small>Pages in sitemap</small>
        </div>
        <div>
          <b>{compact(d.rankingKeywords)}</b>
          <small>Ranking keywords</small>
        </div>
        <div>
          <b>{d.relevance === null ? '—' : `${d.relevance}/10`}</b>
          <small>Topical relevance</small>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--mute)' }}>Content depth combines the number of published pages with how many keywords the site ranks for.</p>
    </Panel>
  );
}

function TechnicalPanel({ d }: { d: NonNullable<Detail['technical']> }) {
  const cwv = d.coreWebVitals === 'good' ? 'Good' : d.coreWebVitals === 'needs_improvement' ? 'Needs work' : d.coreWebVitals === 'poor' ? 'Poor' : '—';
  const row = (ok: boolean | null, title: string, text: string) => (
    <div key={title}>
      {ok === false ? <AlertTriangle size={18} className={s.warnIcon} /> : <Check size={18} className={s.okIcon} style={ok === null ? { background: '#b5c0ca' } : undefined} />}
      <span>
        {title}
        <small>{text}</small>
      </span>
    </div>
  );
  return (
    <Panel icon={<Settings2 size={18} />} title="Technical Health">
      <div className={s.stats}>
        <div>
          <b>{d.pagespeedMobile ?? '—'}</b>
          <small>PageSpeed (Mobile)</small>
        </div>
        <div>
          <b>{d.pagespeedDesktop ?? '—'}</b>
          <small>PageSpeed (Desktop)</small>
        </div>
        <div>
          <b style={{ color: d.coreWebVitals === 'good' ? '#15803d' : undefined }}>{cwv}</b>
          <small>Core Web Vitals</small>
        </div>
      </div>
      <div className={s.checkRows}>
        {row(d.crawlable, 'Crawlability', yes(d.crawlable, 'No site-wide crawl blocks detected', 'robots.txt blocks all crawlers'))}
        {row(d.indexable, 'Indexability', yes(d.indexable, 'Home page can be indexed', 'Home page is not indexable'))}
        {row(d.mobileFriendly, 'Mobile Friendly', yes(d.mobileFriendly, 'Optimized for mobile devices', 'Mobile viewport not configured'))}
        {row(d.https, 'HTTPS Security', yes(d.https, 'Secure connection detected', 'No working HTTPS'))}
      </div>
    </Panel>
  );
}

function DomainPanel({ d }: { d: NonNullable<Detail['domain']> }) {
  return (
    <Panel icon={<Globe size={18} />} title="Domain Signals">
      <div className={s.grid2} style={{ gap: 14 }}>
        {[
          [d.ageYears === null ? '—' : `${d.ageYears} years`, 'Domain age'],
          [d.status ?? '—', 'Registration status'],
          [d.authority === null ? '—' : `${d.authority} / 100`, 'Domain authority'],
          [`.${d.tld}`, 'Top-level domain'],
        ].map(([v, l]) => (
          <div key={l}>
            <b style={{ fontSize: 20 }}>{v}</b>
            <small style={{ display: 'block', color: 'var(--mute)', fontSize: 12 }}>{l}</small>
          </div>
        ))}
      </div>
      {d.registeredAt && <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 12 }}>Registered {formatDate(d.registeredAt)} (RDAP).</p>}
    </Panel>
  );
}

function BreakdownPanel({ r }: { r: Result }) {
  if (!r.breakdown) return null;
  const parts = r.breakdown.filter((b) => b.contributionPct > 0);
  return (
    <Panel icon={<BarChart3 size={18} />} title="Value Breakdown">
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <Donut parts={parts.map((b) => ({ label: b.label, value: b.contributionPct }))} center={money(r.valueMid, r.currency)} sub="Midpoint Value" />
        <div className={s.legend}>
          {parts.map((b, i) => (
            <div key={b.factor}>
              <i style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span>{b.label}</span>
              <b>{b.contributionPct}%</b>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function ListPanel({ icon, title, items, tone, numbered }: { icon: React.ReactNode; title: string; items: string[]; tone?: 'amber'; numbered?: boolean }) {
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
        <p style={{ fontSize: 14, color: 'var(--mute)' }}>None identified.</p>
      )}
    </Panel>
  );
}

function SourcesPanel({ r }: { r: Result }) {
  return (
    <Panel icon={<Database size={18} />} title="Data Sources & Confidence">
      {r.sources
        .filter((x) => x.state !== 'disabled')
        .map((x) => (
          <div key={x.key} className={s.srcRow}>
            <span>{x.label}</span>
            <span className={`${s.pill} ${x.state === 'verified' ? '' : x.state === 'estimated' ? s.soft : s.gray}`}>{SOURCE_STATE_LABEL[x.state]}</span>
          </div>
        ))}
    </Panel>
  );
}

function Locked({ id }: { id: string }) {
  return (
    <div className={s.locked}>
      <Lock size={26} color="#15803d" />
      <h3 style={{ margin: '10px 0 6px' }}>Unlock the full report</h3>
      <p style={{ fontSize: 14, color: 'var(--mute)', maxWidth: 520, margin: '0 auto 14px' }}>Traffic and keyword trends, backlink history, content, technical and domain details, opportunities and PDF download are included on plans with full valuation reports.</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href={`/signup?next=${encodeURIComponent(`/website-value/report/${id}`)}`} className={`${site.btn} ${site.sm}`}>
          Create Free Account
        </Link>
        <Link href="/pricing" className={`${site.btnOutline} ${site.sm}`}>
          See Plans
        </Link>
      </div>
    </div>
  );
}

export default async function ValuationReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<ValuationReport>(`/public/valuations/${id}`, { revalidate: 0 });
  if (!res.ok && res.reason === 'not_found') notFound();
  const v = res.ok ? res.data : null;
  const tab = VALUATION_TABS.some(([k]) => k === tabParam) ? tabParam! : 'overview';
  const r = v?.result ?? null;
  const d = r?.detail ?? null;
  const show = (k: string) => tab === 'overview' || tab === k;

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
                Website Value Report {v?.kind === 'VERIFIED' && <span className={s.pill}>Verified</span>}
              </h1>
              <p style={{ color: 'var(--ink2)' }}>A data-driven valuation based on SEO performance, traffic signals, content, backlinks, social media, and technical health.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/website-value" className={`${site.btnOutline} ${site.sm}`}>
                <RefreshCw size={16} /> New Calculation
              </Link>
              {v?.exports.pdf && v.status === 'COMPLETED' ? (
                <a href={`/website-value/report/${id}/pdf`} className={`${site.btnOutline} ${site.sm}`}>
                  <Download size={16} /> Download PDF
                </a>
              ) : (
                <span className={`${site.btnOutline} ${site.sm}`} aria-disabled="true" title="PDF downloads are available on plans with full valuation reports." style={{ opacity: 0.55, cursor: 'not-allowed' }}>
                  <Download size={16} /> Download PDF
                </span>
              )}
              {v?.verifiedValuation && v.status === 'COMPLETED' && (
                <Link href={`/website-value/report/${v.kind === 'VERIFIED' && v.parentId ? v.parentId : id}/enhance`} className={`${site.btn} ${site.sm}`}>
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
        ) : v.status === 'PENDING' || v.status === 'RUNNING' ? (
          <div className={s.panel} style={{ textAlign: 'center', padding: 48 }}>
            <AutoRefresh />
            <RefreshCw size={30} color="#15803d" />
            <h2 style={{ margin: '12px 0 6px' }}>Calculating the value of {v.domain}…</h2>
            <p style={{ color: 'var(--mute)' }}>We are collecting traffic, backlink, content, technical and domain data. This usually takes under a minute; this page updates automatically.</p>
          </div>
        ) : v.status === 'FAILED' || !r ? (
          <div className={s.panel} style={{ textAlign: 'center', padding: 40 }}>
            <AlertTriangle size={30} color="#d97706" />
            <h2 style={{ margin: '12px 0 6px' }}>We couldn’t value {v.domain}</h2>
            <p style={{ color: 'var(--mute)' }}>{v.error ?? 'Not enough data was available for this domain.'}</p>
            <Link href="/website-value" className={`${site.btn} ${site.sm}`} style={{ marginTop: 16 }}>
              Try Another Domain
            </Link>
          </div>
        ) : (
          <>
            {v.verifiedChild && v.verifiedChild.status === 'COMPLETED' && (
              <div className={s.banner}>
                <span>
                  <ShieldCheck size={18} color="#15803d" style={{ verticalAlign: 'middle' }} /> A verified valuation using your connected data is available.
                </span>
                <Link href={`/website-value/report/${v.verifiedChild.id}`} className={`${site.btn} ${site.sm}`}>
                  View Verified Valuation
                </Link>
              </div>
            )}
            <section className={s.panel}>
              <div className={s.reportTop}>
                {r.screenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={s.shot} src={r.screenshot} alt={`Screenshot of ${v.domain}`} />
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
                    {v.kind === 'VERIFIED' ? 'Verified valuation' : 'Estimate from public data'} · Estimated on {formatDate(v.completedAt ?? v.createdAt)}
                  </div>
                  <p style={{ marginTop: 16, fontWeight: 700, fontSize: 18 }}>Estimated Website Value</p>
                  <div className={s.valueBig}>{v.showRange ? `${money(r.valueLow, r.currency)} – ${money(r.valueHigh, r.currency)}` : money(r.valueMid, r.currency)}</div>
                  {v.showRange && <p style={{ marginTop: 6 }}>Estimated midpoint: {money(r.valueMid, r.currency)}</p>}
                </div>
                <div className={s.confBox}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <b>Confidence Level</b>
                    <span className={`${s.pill} ${r.confidenceLabel === 'Good' ? '' : r.confidenceLabel === 'Fair' ? s.amber : s.gray}`}>{r.confidenceLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0' }}>
                    <span className={s.confPct}>{r.confidence}%</span>
                    <div className={s.bar} style={{ flex: 1 }}>
                      <i style={{ width: `${r.confidence}%` }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink2)', display: 'flex', gap: 6 }}>
                    <Info size={16} style={{ flex: 'none', marginTop: 1 }} />
                    {v.kind === 'VERIFIED' ? 'This valuation uses your connected data sources and business details.' : 'This valuation is based on publicly available data and industry benchmarks. Connect your own data (e.g. GA4) to improve accuracy.'}
                  </p>
                </div>
              </div>
            </section>

            <div className={s.tiles}>
              {[
                { icon: <BarChart3 size={18} />, label: 'Organic Traffic', value: compact(r.metrics.organicTraffic), unit: r.metrics.organicTrafficVerified ? '/ month · verified' : '/ month', delta: r.metrics.trafficGrowthPct, trend: d?.traffic?.trend ?? [] },
                { icon: <Link2 size={18} />, label: 'Backlinks', value: compact(r.metrics.referringDomains), unit: 'referring domains', delta: r.metrics.backlinkGrowthPct, trend: d?.backlinks?.trend ?? [] },
                { icon: <FileText size={18} />, label: 'Content Pages', value: compact(r.metrics.contentPages), unit: 'pages in sitemap', delta: null, trend: d?.traffic?.keywordTrend ?? [] },
                { icon: <Users size={18} />, label: 'Social Media Traffic', value: compact(r.metrics.socialTraffic), unit: r.metrics.socialTraffic === null ? 'connect GA4 to include' : '/ month', delta: null, trend: d?.social?.trend ?? [] },
              ].map((t) => (
                <div key={t.label} className={s.tile}>
                  <small style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700, color: 'var(--navy)' }}>
                    <span className={s.ico} style={{ width: 28, height: 28 }}>
                      {t.icon}
                    </span>
                    {t.label}
                  </small>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                    <div>
                      <b>{t.value}</b>
                      <small style={{ display: 'block' }}>{t.unit}</small>
                    </div>
                    <Sparkline points={t.trend} />
                  </div>
                  <Delta pct={t.delta} />
                </div>
              ))}
            </div>

            <nav className={s.tabs} aria-label="Report sections">
              {VALUATION_TABS.map(([k, l]) => (
                <Link key={k} href={k === 'overview' ? `/website-value/report/${id}` : `/website-value/report/${id}?tab=${k}`} aria-current={tab === k ? 'page' : undefined} scroll={false}>
                  {l}
                </Link>
              ))}
            </nav>

            {!d && tab !== 'overview' && tab !== 'breakdown' ? (
              <Locked id={id} />
            ) : (
              <>
                {d && (show('traffic') || show('backlinks') || show('social')) && (
                  <div className={tab === 'overview' ? s.grid3 : undefined}>
                    {show('traffic') && d.traffic && <TrafficPanel d={d.traffic} />}
                    {show('backlinks') && d.backlinks && <BacklinksPanel d={d.backlinks} />}
                    {show('social') && d.social && <SocialPanel d={d.social} id={v.parentId ?? id} />}
                  </div>
                )}
                {d && (show('content') || show('technical')) && (
                  <div className={tab === 'overview' ? s.grid2 : undefined}>
                    {show('content') && d.content && <ContentPanel d={d.content} />}
                    {show('technical') && d.technical && <TechnicalPanel d={d.technical} />}
                  </div>
                )}
                {(show('domain') || show('breakdown')) && (
                  <div className={tab === 'overview' ? s.grid3 : undefined}>
                    {show('domain') && d?.domain && <DomainPanel d={d.domain} />}
                    {show('breakdown') && <BreakdownPanel r={r} />}
                    {tab === 'overview' && <ListPanel icon={<AlertTriangle size={18} />} title="Potential Risks" items={r.risks} tone="amber" />}
                  </div>
                )}
                {(tab === 'overview' || tab === 'opportunities') && (
                  <div className={tab === 'overview' ? s.grid3 : undefined}>
                    {tab === 'overview' && <ListPanel icon={<Target size={18} />} title="Key Value Drivers" items={r.drivers} />}
                    {d?.opportunities && <ListPanel icon={<Lightbulb size={18} />} title="Ways to Increase Website Value" items={d.opportunities} numbered />}
                    {tab === 'overview' && <SourcesPanel r={r} />}
                  </div>
                )}
                {!d && tab === 'overview' && <Locked id={id} />}
              </>
            )}

            {v.verifiedValuation && v.kind !== 'VERIFIED' && (
              <div className={s.banner}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span className={s.ico} style={{ width: 48, height: 48 }}>
                    <Target size={24} />
                  </span>
                  <div>
                    <h3 style={{ margin: 0 }}>Get a More Accurate Valuation</h3>
                    <p style={{ fontSize: 14, color: 'var(--ink2)' }}>Connect Google Analytics and Google Search Console to use your own data for a verified valuation with higher confidence and deeper insights.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href={`/website-value/report/${id}/enhance`} className={`${site.btn} ${site.sm}`}>
                    Improve Valuation Accuracy <ArrowRight size={16} />
                  </Link>
                  <Link href={`/signup?website=${encodeURIComponent(v.domain)}`} className={`${site.btnOutline} ${site.sm}`}>
                    Run Full SEO Audit <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--mute)' }}>{v.disclaimer}</p>
          </>
        )}
      </div>
    </div>
  );
}
