'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BarChart3, CheckCircle2, Clock, Database, Eye, FileText, Play, RotateCcw, Save, Settings2, ShieldCheck, Users } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import { apiAction } from '@/lib/actions';
import { getAdminValuation } from '@/lib/admin-actions';
import { formatDateTime } from '@/lib/format';
import { ACCESS_LABELS, CURRENCIES, FACTOR_HINTS, FACTORS, REPORT_SECTIONS, type AccessLevel, type AdminSettingsPayload, type ChangeRow, type Factor, type HistoryRow, type Settings, type SourceRow } from './types';
import s from './valuation-admin.module.css';

export type EditorSection = 'model' | 'preview' | 'sources' | 'confidence' | 'access' | 'history' | 'calculator' | 'templates';

const COLORS: Record<Factor, string> = { traffic: '#f59e0b', backlinks: '#3b5bdb', content: '#7c5cf0', technical: '#ef9a3a', social: '#06b6d4', brand: '#ec4899' };
const COUNTRIES = [
  ['us', 'United States'],
  ['gb', 'United Kingdom'],
  ['ca', 'Canada'],
  ['au', 'Australia'],
  ['in', 'India'],
  ['de', 'Germany'],
  ['fr', 'France'],
  ['ae', 'United Arab Emirates'],
  ['pk', 'Pakistan'],
];
const LANGUAGES = [
  ['en', 'English'],
  ['de', 'German'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['ar', 'Arabic'],
];
const SECTION_LABELS: Record<(typeof REPORT_SECTIONS)[number], string> = {
  traffic: 'Traffic & Search',
  backlinks: 'Backlinks',
  content: 'Content',
  social: 'Social Media',
  technical: 'Technical Health',
  domain: 'Domain Signals',
  breakdown: 'Value Breakdown',
  opportunities: 'Opportunities',
};

type Preview = { status: string; error: string | null; result: { valueLow: number; valueHigh: number; valueMid: number; currency: string; confidence: number; confidenceLabel: string; breakdown: { label: string; factor: string; contributionPct: number }[] | null } | null };

const money = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const clampNum = (v: string, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

function Card({ icon, title, sub, right, children }: { icon: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span className={s.icon}>{icon}</span>
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * Valuation Engine Settings. One editor, rendered with different sections by
 * the Website Value Calculator admin pages. Saves the whole settings object;
 * the API validates and records a change-history entry.
 */
export function ValuationEditor({
  payload,
  sources = [],
  changes = { total: 0, rows: [] },
  tests = [],
  sections,
}: {
  payload: AdminSettingsPayload;
  sources?: SourceRow[];
  changes?: { total: number; rows: ChangeRow[] };
  tests?: HistoryRow[];
  sections: EditorSection[];
}) {
  const router = useRouter();
  const [st, setSt] = useState<Settings>(payload.settings);
  const [saved, setSaved] = useState(JSON.stringify(payload.settings));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetAck, setResetAck] = useState(false);
  const [testDomain, setTestDomain] = useState('example.com');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testing, setTesting] = useState(false);
  const [accessTab, setAccessTab] = useState<'plans' | 'limits' | 'exports' | 'features'>('plans');
  const [historyTab, setHistoryTab] = useState<'changes' | 'tests' | 'formula'>('changes');
  const dirty = JSON.stringify(st) !== saved;
  const has = (x: EditorSection) => sections.includes(x);

  const total = FACTORS.reduce((t, f) => t + (Number(st.weights[f]) || 0), 0);
  const ctotal = Object.values(st.confidence).reduce((t, v) => t + (Number(v) || 0), 0);
  const weightsOk = Math.round(total) === 100;
  const confOk = Math.round(ctotal) === 100;
  const planRows = useMemo(() => [{ code: 'free', name: 'Free (no plan / visitors)' }, ...payload.plans.filter((p) => p.code !== 'free')], [payload.plans]);

  const patch = <K extends keyof Settings>(k: K, v: Settings[K]) => setSt((x) => ({ ...x, [k]: v }));

  const normalize = () => {
    if (!total) return;
    const scaled = FACTORS.map((f) => [f, Math.round(((Number(st.weights[f]) || 0) / total) * 100)] as const);
    const diff = 100 - scaled.reduce((t, [, v]) => t + v, 0);
    const biggest = [...scaled].sort((a, b) => b[1] - a[1])[0][0];
    patch('weights', Object.fromEntries(scaled.map(([f, v]) => [f, f === biggest ? v + diff : v])) as Settings['weights']);
  };

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await apiAction<Settings>('PUT', '/admin/valuation/settings', { settings: st }, ['/admin/valuation']);
      if (!r.ok) return setMsg({ ok: false, text: r.message });
      setSt(r.data);
      setSaved(JSON.stringify(r.data));
      setMsg({ ok: true, text: 'Settings saved. New calculations use them immediately.' });
      router.refresh();
    });

  const reset = () =>
    start(async () => {
      const r = await apiAction<Settings>('POST', '/admin/valuation/settings/reset', {}, ['/admin/valuation']);
      setResetOpen(false);
      setResetAck(false);
      if (!r.ok) return setMsg({ ok: false, text: r.message });
      setSt(r.data);
      setSaved(JSON.stringify(r.data));
      setMsg({ ok: true, text: 'All valuation settings were reset to the defaults.' });
      router.refresh();
    });

  const runTest = async () => {
    setTesting(true);
    setPreview(null);
    setMsg(null);
    const r = await apiAction<{ id: string }>('POST', '/admin/valuation/test', { domain: testDomain });
    if (!r.ok) {
      setTesting(false);
      return setMsg({ ok: false, text: r.message });
    }
    for (let i = 0; i < 60; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const p = await getAdminValuation(r.data.id);
      if (p.ok) {
        const v = p.data as Preview;
        setPreview(v);
        if (v.status === 'COMPLETED' || v.status === 'FAILED') break;
      }
    }
    setTesting(false);
    router.refresh();
  };

  const num = (label: string, value: number, onChange: (n: number) => void, opts: { min: number; max: number; step?: number; hint?: string; prefix?: string }) => (
    <label className={s.num}>
      {label}
      <input type="number" min={opts.min} max={opts.max} step={opts.step ?? 1} value={value} onChange={(e) => onChange(clampNum(e.target.value, opts.min, opts.max))} />
      {opts.hint && <span className={s.hint}>{opts.hint}</span>}
    </label>
  );

  const headerActions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {has('model') && (
        <>
          {tests[0] ? (
            <ButtonLink href={`/admin/valuation/history/${tests[0].id}`} variant="outline" icon={<Eye size={16} />}>
              Preview Report
            </ButtonLink>
          ) : (
            <Button variant="outline" icon={<Eye size={16} />} disabled title="Run a test calculation first">
              Preview Report
            </Button>
          )}
          <Button variant="outline" icon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)}>
            Reset to Default
          </Button>
          <Button variant="outline" icon={<Play size={16} />} onClick={runTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test Calculation'}
          </Button>
        </>
      )}
      <Button variant="green" icon={<Save size={16} />} onClick={save} disabled={pending || !dirty || !weightsOk || !confOk}>
        {pending ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={s.hint}>{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
        {headerActions}
      </div>
      {msg && (
        <div className={msg.ok ? s.ok : s.bad} role="status">
          {msg.text}
        </div>
      )}

      {(has('model') || has('preview')) && (
        <div className={has('preview') ? s.top : undefined}>
          {has('model') && (
            <Card icon={<Settings2 size={20} />} title="1. Valuation Model" sub="Set the factors and weights used to calculate website value." right={<span className={`${s.badge} ${weightsOk ? '' : s.red}`}>Total Weight: {Math.round(total * 10) / 10}%</span>}>
              <div className={s.model}>
                <div>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Factor</th>
                        <th>Weight</th>
                        <th style={{ width: '30%' }} aria-label="Weight bar" />
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FACTORS.map((f) => (
                        <tr key={f}>
                          <td style={{ fontWeight: 600 }}>{payload.factorLabels[f]}</td>
                          <td>
                            <span className={s.weight}>
                              <input type="number" min={0} max={100} aria-label={`${payload.factorLabels[f]} weight`} value={st.weights[f]} onChange={(e) => patch('weights', { ...st.weights, [f]: clampNum(e.target.value, 0, 100) })} />%
                            </span>
                          </td>
                          <td>
                            <div className={s.bar}>
                              <i style={{ width: `${st.weights[f]}%`, background: COLORS[f] }} />
                            </div>
                          </td>
                          <td className={s.hint}>{FACTOR_HINTS[f]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={weightsOk ? s.ok : s.bad}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {weightsOk ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                      {weightsOk ? 'Weights are valid — total equals 100%' : `Weights must total 100% (currently ${Math.round(total * 10) / 10}%)`}
                    </span>
                    <Button size="sm" variant="outline" onClick={normalize} disabled={weightsOk || !total}>
                      Normalize to 100%
                    </Button>
                  </div>
                </div>
                <div>
                  <b style={{ fontSize: 14 }}>Valuation Multipliers</b>
                  <div style={{ marginTop: 10 }}>
                    {num('Minimum Value Multiplier', st.multipliers.min, (n) => patch('multipliers', { ...st.multipliers, min: n }), { min: 0.1, max: 50, step: 0.1, hint: 'Applied to annual traffic value for the weakest sites.' })}
                    {num('Maximum Value Multiplier', st.multipliers.max, (n) => patch('multipliers', { ...st.multipliers, max: n }), { min: 0.1, max: 50, step: 0.1, hint: 'Applied for the strongest sites.' })}
                    {num('Industry Adjustment Range (±%)', st.industryAdjustmentPct, (n) => patch('industryAdjustmentPct', n), { min: 0, max: 90, hint: 'Width of the value range around the midpoint.' })}
                    {num('Value per Visit (USD)', st.valuePerVisitUsd, (n) => patch('valuePerVisitUsd', n), { min: 0, max: 100, step: 0.01, hint: 'Used when keyword traffic value is unavailable.' })}
                    <label className={s.num}>
                      Default Currency
                      <select value={st.currency.code} onChange={(e) => patch('currency', { code: e.target.value, rateFromUsd: e.target.value === 'USD' ? 1 : st.currency.rateFromUsd })}>
                        {CURRENCIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    {st.currency.code !== 'USD' && num(`Exchange rate (1 USD = ? ${st.currency.code})`, st.currency.rateFromUsd, (n) => patch('currency', { ...st.currency, rateFromUsd: n }), { min: 0.0001, max: 100000, step: 0.0001, hint: 'Fixed rate; update it when it changes.' })}
                    <b style={{ fontSize: 14 }}>Valuation Ranges</b>
                    <div className={s.row}>
                      <span>Show value range (min – max)</span>
                      <Toggle label="Show value range" checked={st.showRange} onChange={(v) => patch('showRange', v)} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
          {has('preview') && (
            <Card icon={<BarChart3 size={20} />} title="Calculation Preview" sub="See how the current settings affect valuation.">
              <label className={s.num}>
                Test Domain
                <span style={{ display: 'flex', gap: 8 }}>
                  <input style={{ textAlign: 'left' }} value={testDomain} onChange={(e) => setTestDomain(e.target.value)} maxLength={253} />
                  <Button size="sm" onClick={runTest} disabled={testing || !testDomain.trim()}>
                    {testing ? 'Running…' : 'Run Test'}
                  </Button>
                </span>
                <span className={s.hint}>Tests use the saved settings{dirty ? ' — save your changes first to test them' : ''}. Test runs never count against limits.</span>
              </label>
              <div className={s.preview}>
                {preview?.status === 'COMPLETED' && preview.result ? (
                  <>
                    <div>
                      <small>Estimated Website Value</small>
                      <div className={s.big}>
                        {money(preview.result.valueLow, preview.result.currency)} – {money(preview.result.valueHigh, preview.result.currency)}
                      </div>
                      <small>Midpoint: {money(preview.result.valueMid, preview.result.currency)}</small>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className={s.big}>{preview.result.confidence}%</div>
                      <small>Confidence</small>
                    </div>
                  </>
                ) : preview?.status === 'FAILED' ? (
                  <span style={{ color: 'var(--red)' }}>{preview.error ?? 'The test failed.'}</span>
                ) : (
                  <span className={s.hint}>{testing ? `Calculating ${testDomain}… (collecting live data, usually under a minute)` : 'Run a test to see the estimated value for a domain.'}</span>
                )}
              </div>
              <b style={{ fontSize: 14 }}>Factor Contribution {preview?.result?.breakdown ? '(test result)' : '(current weights)'}</b>
              {FACTORS.map((f) => {
                const pct = preview?.result?.breakdown?.find((b) => b.factor === f)?.contributionPct ?? st.weights[f];
                return (
                  <div key={f} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,150px) minmax(0,1fr) 40px', gap: 10, alignItems: 'center', fontSize: 13, padding: '5px 0' }}>
                    <span>{payload.factorLabels[f]}</span>
                    <div className={s.bar}>
                      <i style={{ width: `${pct}%`, background: COLORS[f] }} />
                    </div>
                    <b>{pct}%</b>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {(has('sources') || has('confidence')) && (
        <div className={has('sources') && has('confidence') ? s.two : undefined}>
          {has('sources') && (
            <Card icon={<Database size={20} />} title="2. Data Sources" sub="Enable or disable data sources and see their status.">
              <div style={{ overflowX: 'auto' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Data Source</th>
                      <th>Status</th>
                      <th>Usage (30 days)</th>
                      <th>Last Sync</th>
                      <th>Setup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((src) => (
                      <tr key={src.key}>
                        <td style={{ fontWeight: 600 }}>{src.label}</td>
                        <td>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Toggle label={`Use ${src.label}`} checked={st.sources[src.key]} onChange={(v) => patch('sources', { ...st.sources, [src.key]: v })} />
                            <span className={`${s.badge} ${!st.sources[src.key] ? s.gray : src.configured ? '' : s.amber}`}>{!st.sources[src.key] ? 'Off' : src.configured ? (src.key === 'ga4' || src.key === 'gsc' ? 'Connected' : 'Active') : 'Not configured'}</span>
                          </span>
                        </td>
                        <td>{src.requests30d.toLocaleString('en-US')} requests</td>
                        <td>{src.lastSync ? formatDateTime(src.lastSync) : '—'}</td>
                        <td className={s.hint} style={{ maxWidth: 260 }}>
                          {src.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {has('confidence') && (
            <Card icon={<ShieldCheck size={20} />} title="3. Confidence & Coverage Rules" sub="Define how confidence is calculated based on data availability." right={<span className={`${s.badge} ${confOk ? '' : s.red}`}>Total: {Math.round(ctotal)}%</span>}>
              {(
                [
                  ['coverage', 'Data Coverage', 'Share of valuation factors with data'],
                  ['reliability', 'Source Reliability', 'Verified (GA4/GSC) sources count more than estimates'],
                  ['freshness', 'Data Freshness', 'Recency of the collected data'],
                  ['consistency', 'Data Consistency', 'Agreement between estimated and verified traffic'],
                ] as const
              ).map(([k, t, d]) => (
                <div key={k} className={s.slider}>
                  <span className={s.icon} style={{ width: 30, height: 30 }}>
                    <ShieldCheck size={15} />
                  </span>
                  <span>
                    <b>{t}</b>
                    <span className={s.hint}>{d}</span>
                  </span>
                  <input type="range" min={0} max={100} value={st.confidence[k]} aria-label={t} onChange={(e) => patch('confidence', { ...st.confidence, [k]: Number(e.target.value) })} />
                  <input type="number" min={0} max={100} value={st.confidence[k]} aria-label={`${t} weight`} onChange={(e) => patch('confidence', { ...st.confidence, [k]: clampNum(e.target.value, 0, 100) })} />
                </div>
              ))}
              {!confOk && <div className={s.bad}>Confidence weights must total 100%.</div>}
              <b style={{ display: 'block', marginTop: 14, fontSize: 14 }}>Confidence Thresholds</b>
              <div className={s.thresholds}>
                <label className={s.num}>
                  Low Confidence (below)
                  <input type="number" min={1} max={99} value={st.thresholds.low} onChange={(e) => patch('thresholds', { ...st.thresholds, low: clampNum(e.target.value, 1, 99) })} />
                </label>
                <label className={s.num}>
                  Medium Confidence
                  <input disabled value={`${st.thresholds.low}% – ${st.thresholds.high}%`} />
                </label>
                <label className={s.num}>
                  High Confidence (at or above)
                  <input type="number" min={2} max={100} value={st.thresholds.high} onChange={(e) => patch('thresholds', { ...st.thresholds, high: clampNum(e.target.value, 2, 100) })} />
                </label>
              </div>
            </Card>
          )}
        </div>
      )}

      {(has('access') || has('history')) && (
        <div className={has('access') && has('history') ? s.two : undefined}>
          {has('access') && (
            <Card icon={<Users size={20} />} title="4. Access & Usage Controls" sub="Manage feature availability, limits, and export options.">
              <div className={s.tabs} role="tablist">
                {(
                  [
                    ['plans', 'Plan Access'],
                    ['limits', 'Usage Limits'],
                    ['exports', 'Export Options'],
                    ['features', 'Feature Controls'],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={accessTab === k} onClick={() => setAccessTab(k)} type="button">
                    {l}
                  </button>
                ))}
              </div>
              {accessTab === 'plans' &&
                planRows.map((p) => {
                  const level: AccessLevel = st.access[p.code] ?? st.access.free ?? 'limited';
                  return (
                    <div key={p.code} className={s.row}>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Toggle label={`${p.name} access`} checked={level !== 'off'} onChange={(v) => patch('access', { ...st.access, [p.code]: v ? (level === 'off' ? 'limited' : level) : 'off' })} />
                        {p.name}
                      </span>
                      <select value={level} onChange={(e) => patch('access', { ...st.access, [p.code]: e.target.value as AccessLevel })} aria-label={`${p.name} access level`}>
                        {(Object.keys(ACCESS_LABELS) as AccessLevel[]).map((k) => (
                          <option key={k} value={k}>
                            {ACCESS_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              {accessTab === 'limits' && (
                <div className={s.thresholds} style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                  {num('Calculations per month (Free / visitors)', st.limits.freePerMonth, (n) => patch('limits', { ...st.limits, freePerMonth: n }), { min: 0, max: 100000, hint: 'Per account, or per visitor IP without an account.' })}
                  {num('Calculations per month (Paid)', st.limits.paidPerMonth, (n) => patch('limits', { ...st.limits, paidPerMonth: n }), { min: 0, max: 100000, hint: 'Per user with an active subscription.' })}
                  {num('PDF exports per month', st.limits.pdfPerMonth, (n) => patch('limits', { ...st.limits, pdfPerMonth: n }), { min: 0, max: 100000, hint: 'Per workspace.' })}
                  {num('Cache results (hours)', st.calculator.cacheHours, (n) => patch('calculator', { ...st.calculator, cacheHours: n }), { min: 0, max: 720, hint: 'Repeat requests for the same domain reuse the result.' })}
                  <div className={s.row}>
                    <span>API / JSON access</span>
                    <Toggle label="API access" checked={st.limits.apiAccess} onChange={(v) => patch('limits', { ...st.limits, apiAccess: v })} />
                  </div>
                </div>
              )}
              {accessTab === 'exports' && (
                <>
                  <div className={s.row}>
                    <span>
                      PDF download <span className={s.hint}>· plans with full access</span>
                    </span>
                    <Toggle label="PDF download" checked={st.exports.pdf} onChange={(v) => patch('exports', { ...st.exports, pdf: v })} />
                  </div>
                  <div className={s.row}>
                    <span>
                      JSON export <span className={s.hint}>· plans with API access</span>
                    </span>
                    <Toggle label="JSON export" checked={st.exports.json} onChange={(v) => patch('exports', { ...st.exports, json: v })} />
                  </div>
                </>
              )}
              {accessTab === 'features' && (
                <>
                  {(
                    [
                      ['calculator', 'Public calculator enabled', st.calculator.enabled, (v: boolean) => patch('calculator', { ...st.calculator, enabled: v })],
                      ['verified', 'Verified valuations (GA4 / Search Console / business inputs)', st.features.verifiedValuation, (v: boolean) => patch('features', { ...st.features, verifiedValuation: v })],
                      ['opps', 'Show “Ways to Increase Website Value”', st.features.opportunities, (v: boolean) => patch('features', { ...st.features, opportunities: v })],
                      ['social', 'Show the social media section', st.features.socialSection, (v: boolean) => patch('features', { ...st.features, socialSection: v })],
                    ] as const
                  ).map(([k, l, v, on]) => (
                    <div key={k} className={s.row}>
                      <span>{l}</span>
                      <Toggle label={l} checked={v} onChange={on} />
                    </div>
                  ))}
                </>
              )}
            </Card>
          )}
          {has('history') && (
            <Card icon={<Clock size={20} />} title="5. Testing & Change History" sub="Test your settings and view recent changes.">
              <div className={s.tabs} role="tablist">
                {(
                  [
                    ['changes', 'Recent Changes'],
                    ['tests', 'Test History'],
                    ['formula', 'Formula Details'],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={historyTab === k} onClick={() => setHistoryTab(k)} type="button">
                    {l}
                  </button>
                ))}
              </div>
              {historyTab === 'changes' &&
                (changes.rows.length ? (
                  <>
                    <table className={s.table}>
                      <thead>
                        <tr>
                          <th>Date &amp; Time</th>
                          <th>Changed By</th>
                          <th>Change</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.rows.slice(0, 6).map((c) => (
                          <tr key={c.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(c.at)}</td>
                            <td>{c.by}</td>
                            <td>{c.change}</td>
                            <td>
                              <span className={`${s.badge} ${c.current ? '' : s.gray}`}>{c.current ? 'Active' : 'Superseded'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className={s.hint} style={{ marginTop: 10 }}>
                      Showing {Math.min(6, changes.rows.length)} of {changes.total} changes ·{' '}
                      <Link href="/admin/audit-logs?q=valuation.settings" style={{ color: 'var(--blue)' }}>
                        View All Changes →
                      </Link>
                    </p>
                  </>
                ) : (
                  <p className={s.hint}>No changes yet. The defaults are in use.</p>
                ))}
              {historyTab === 'tests' &&
                (tests.length ? (
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Domain</th>
                        <th>Result</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tests.slice(0, 8).map((t) => (
                        <tr key={t.id}>
                          <td>{formatDateTime(t.createdAt)}</td>
                          <td>
                            <Link href={`/admin/valuation/history/${t.id}`} style={{ color: 'var(--blue)' }}>
                              {t.domain}
                            </Link>
                          </td>
                          <td>{t.valueMid !== null ? `${money(t.valueLow!, t.currency)} – ${money(t.valueHigh!, t.currency)}` : '—'}</td>
                          <td>
                            <span className={`${s.badge} ${t.status === 'FAILED' ? s.red : t.status === 'COMPLETED' ? '' : s.gray}`}>{t.status.toLowerCase()}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className={s.hint}>No test calculations yet. Use Test Calculation above.</p>
                ))}
              {historyTab === 'formula' && (
                <div className={s.formula}>
                  <p>
                    1. Each factor gets a score from 0 to 1 from the collected data (factors without data are left out and lower confidence).
                  </p>
                  <p>
                    2. Composite score <code>S = Σ weight × score ÷ Σ weight</code>.
                  </p>
                  <p>
                    3. Annual traffic value <code>A = monthly organic traffic value × 12</code> (keyword traffic cost from DataForSEO, else visits × value per visit).
                  </p>
                  <p>
                    4. Midpoint <code>= A × (min multiplier + (max − min) × S)</code>, converted to the default currency.
                  </p>
                  <p>
                    5. With revenue: <code>0.6 × annual profit × (1.5 + 2.5 × S) + 0.4 × traffic-based value</code>.
                  </p>
                  <p>
                    6. Range <code>= midpoint × (1 ± industry adjustment × (2 − confidence) × 0.7)</code>.
                  </p>
                  <p>
                    7. Confidence <code>= Σ rule weight × (coverage, reliability, freshness, consistency)</code>; labels use the thresholds above.
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {has('calculator') && (
        <Card icon={<Settings2 size={20} />} title="Public Calculator" sub="How the free calculator on /website-value behaves.">
          <div className={s.row}>
            <span>Calculator enabled</span>
            <Toggle label="Calculator enabled" checked={st.calculator.enabled} onChange={(v) => patch('calculator', { ...st.calculator, enabled: v })} />
          </div>
          <div className={s.row}>
            <span>Show value range (min – max)</span>
            <Toggle label="Show value range" checked={st.showRange} onChange={(v) => patch('showRange', v)} />
          </div>
          <div className={s.thresholds}>
            <label className={s.num}>
              Search market (country)
              <select value={st.calculator.country} onChange={(e) => patch('calculator', { ...st.calculator, country: e.target.value })}>
                {COUNTRIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.num}>
              Language
              <select value={st.calculator.language} onChange={(e) => patch('calculator', { ...st.calculator, language: e.target.value })}>
                {LANGUAGES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {num('Cache results (hours)', st.calculator.cacheHours, (n) => patch('calculator', { ...st.calculator, cacheHours: n }), { min: 0, max: 720 })}
          </div>
          {num('Free calculations per month (per visitor or account)', st.limits.freePerMonth, (n) => patch('limits', { ...st.limits, freePerMonth: n }), { min: 0, max: 100000 })}
        </Card>
      )}

      {has('templates') && (
        <Card icon={<FileText size={20} />} title="Report Template" sub="Sections shown in full reports and PDFs, and the disclaimer.">
          {REPORT_SECTIONS.map((k) => (
            <div key={k} className={s.row}>
              <span>{SECTION_LABELS[k]}</span>
              <Toggle label={SECTION_LABELS[k]} checked={st.report.sections[k]} onChange={(v) => patch('report', { ...st.report, sections: { ...st.report.sections, [k]: v } })} />
            </div>
          ))}
          <label className={s.num} style={{ marginTop: 12 }}>
            Disclaimer (shown on every report and PDF)
            <textarea
              style={{ minHeight: 90, border: '1px solid var(--line-strong)', borderRadius: 8, padding: 10, font: 'inherit', fontSize: 13 }}
              maxLength={600}
              value={st.report.disclaimer}
              onChange={(e) => patch('report', { ...st.report, disclaimer: e.target.value })}
            />
          </label>
        </Card>
      )}

      {resetOpen && (
        <div className={s.modalBack} role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div className={s.modal}>
            <div style={{ display: 'flex', gap: 12 }}>
              <span className={s.icon} style={{ background: 'var(--red-50)', color: 'var(--red)' }}>
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 id="reset-title" style={{ fontSize: 18, margin: 0 }}>
                  Reset to Default Settings?
                </h2>
                <p className={s.hint} style={{ fontSize: 14, marginTop: 6 }}>
                  This will restore all valuation settings to the default configuration. Your current changes will be lost.
                </p>
              </div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '16px 0', fontSize: 14 }}>
              <input type="checkbox" checked={resetAck} onChange={(e) => setResetAck(e.target.checked)} /> I understand this action cannot be undone.
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} disabled={!resetAck || pending} onClick={reset}>
                Reset to Default
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
