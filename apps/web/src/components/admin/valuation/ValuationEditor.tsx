'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BarChart3, CheckCircle2, Clock, Database, FileText, Play, Plus, RotateCcw, Save, Scale, Settings2, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import { apiAction } from '@/lib/actions';
import { getAdminValuation } from '@/lib/admin-actions';
import { formatDateTime } from '@/lib/format';
import { BUSINESS_MODEL_LABEL, BUSINESS_MODELS } from '@/lib/valuation';
import { ACCESS_LABELS, CATEGORIES, CATEGORY_HINTS, CURRENCIES, SOURCES, type AccessLevel, type AdminConfigPayload, type Category, type Comparable, type Config, type HistoryRow, type SourceRow } from './types';
import s from './valuation-admin.module.css';

export type EditorSection = 'model' | 'comparables' | 'preview' | 'sources' | 'access' | 'history' | 'calculator' | 'templates';

const COLORS: Record<Category, string> = { visibility: '#3b5bdb', technical: '#ef9a3a', performance: '#06b6d4', content: '#7c5cf0', risk: '#15803d' };
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

type Preview = { status: string; error: string | null; qualityScore: number | null; confidence: string | null; evidenceCoveragePct: number | null; monetaryRange: { low: number; high: number; currency: string } | null; breakdown: { category: string; label: string; score: number | null; contributionPct: number }[] | null; limitations: string[] };

const money = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const clampNum = (v: string, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const today = () => new Date().toISOString().slice(0, 10);
const monthsAgo = (d: string) => (Date.now() - new Date(d).getTime()) / (30.44 * 86_400_000);

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
 * Valuation methodology editor. One editor, rendered with different sections by
 * the Website Value Calculator admin pages. Each save publishes a new immutable
 * methodology version (append-only, audited); existing results keep the version
 * they were calculated with.
 */
export function ValuationEditor({ payload, sources = [], tests = [], sections }: { payload: AdminConfigPayload; sources?: SourceRow[]; tests?: HistoryRow[]; sections: EditorSection[] }) {
  const router = useRouter();
  const [st, setSt] = useState<Config>(payload.config);
  const [saved, setSaved] = useState(JSON.stringify(payload.config));
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [testDomain, setTestDomain] = useState('example.com');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testing, setTesting] = useState(false);
  const [accessTab, setAccessTab] = useState<'plans' | 'limits'>('plans');
  const [historyTab, setHistoryTab] = useState<'versions' | 'tests' | 'formula'>('versions');
  const dirty = JSON.stringify(st) !== saved;
  const has = (x: EditorSection) => sections.includes(x);

  const total = CATEGORIES.reduce((t, c) => t + (Number(st.weights[c]) || 0), 0);
  const weightsOk = Math.round(total) === 100;
  const compsOk = st.comparables.every((c) => c.label.trim() && c.source.trim() && c.multipleLow > 0 && c.multipleHigh >= c.multipleLow && /^\d{4}-\d{2}-\d{2}$/.test(c.observedAt));
  const planRows = useMemo(() => [{ code: 'free', name: 'Free (no plan / visitors)' }, ...payload.plans.filter((p) => p.code !== 'free')], [payload.plans]);

  const patch = <K extends keyof Config>(k: K, v: Config[K]) => setSt((x) => ({ ...x, [k]: v }));
  const setComp = (i: number, c: Partial<Comparable>) => patch('comparables', st.comparables.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const normalize = () => {
    if (!total) return;
    const scaled = CATEGORIES.map((c) => [c, Math.round(((Number(st.weights[c]) || 0) / total) * 100)] as const);
    const diff = 100 - scaled.reduce((t, [, v]) => t + v, 0);
    const biggest = [...scaled].sort((a, b) => b[1] - a[1])[0][0];
    patch('weights', Object.fromEntries(scaled.map(([c, v]) => [c, c === biggest ? v + diff : v])) as Config['weights']);
  };

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await apiAction<{ version: string; config: Config }>('PATCH', '/admin/valuation/config', { config: st, note: note.trim() || undefined }, ['/admin/valuation']);
      if (!r.ok) return setMsg({ ok: false, text: r.message });
      setSt(r.data.config);
      setSaved(JSON.stringify(r.data.config));
      setNote('');
      setMsg({ ok: true, text: `Published methodology ${r.data.version}. New calculations use it immediately; existing results keep their version.` });
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
        if (['completed', 'failed', 'cancelled'].includes(v.status)) break;
      }
    }
    setTesting(false);
    router.refresh();
  };

  const num = (label: string, value: number, onChange: (n: number) => void, opts: { min: number; max: number; step?: number; hint?: string }) => (
    <label className={s.num}>
      {label}
      <input type="number" min={opts.min} max={opts.max} step={opts.step ?? 1} value={value} onChange={(e) => onChange(clampNum(e.target.value, opts.min, opts.max))} />
      {opts.hint && <span className={s.hint}>{opts.hint}</span>}
    </label>
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className={s.saveBar}>
        <span className={s.hint}>
          Current methodology <b>{payload.version}</b> · {dirty ? 'You have unsaved changes.' : 'All changes published.'}
        </span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {dirty && (
            <>
              <input className={s.noteInput} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Change note (shown in version history)" aria-label="Change note" />
              <Button variant="outline" icon={<RotateCcw size={16} />} onClick={() => setSt(JSON.parse(saved) as Config)}>
                Discard
              </Button>
            </>
          )}
          <Button variant="green" icon={<Save size={16} />} onClick={save} disabled={pending || !dirty || !weightsOk || !compsOk}>
            {pending ? 'Publishing…' : 'Publish New Version'}
          </Button>
        </div>
      </div>
      {msg && (
        <div className={msg.ok ? s.ok : s.bad} role="status">
          {msg.text}
        </div>
      )}

      {(has('model') || has('preview')) && (
        <div className={has('preview') && has('model') ? s.top : undefined}>
          {has('model') && (
            <Card icon={<Settings2 size={20} />} title="1. Quality Score Model" sub="Published category weights for the 0–100 quality score." right={<span className={`${s.badge} ${weightsOk ? '' : s.red}`}>Total Weight: {Math.round(total * 10) / 10}%</span>}>
              <div className={s.model}>
                <div style={{ overflowX: 'auto' }}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Weight</th>
                        <th style={{ width: '24%' }} aria-label="Weight bar" />
                        <th>Signals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map((c) => (
                        <tr key={c}>
                          <td style={{ fontWeight: 600 }}>{payload.categoryLabels[c]}</td>
                          <td>
                            <span className={s.weight}>
                              <input type="number" min={0} max={100} aria-label={`${payload.categoryLabels[c]} weight`} value={st.weights[c]} onChange={(e) => patch('weights', { ...st.weights, [c]: clampNum(e.target.value, 0, 100) })} />%
                            </span>
                          </td>
                          <td>
                            <div className={s.bar}>
                              <i style={{ width: `${st.weights[c]}%`, background: COLORS[c] }} />
                            </div>
                          </td>
                          <td className={s.hint}>{CATEGORY_HINTS[c]}</td>
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
                  {num('Minimum evidence coverage (%)', st.minEvidencePct, (n) => patch('minEvidencePct', n), { min: 0, max: 100, hint: 'Below this share of weighted categories with evidence, no score is shown.' })}
                  {num('Risk discount below score', st.riskAdjustment.belowScore, (n) => patch('riskAdjustment', { ...st.riskAdjustment, belowScore: n }), { min: 0, max: 100, hint: 'Quality scores under this value reduce the range.' })}
                  {num('Risk discount (%)', st.riskAdjustment.pct, (n) => patch('riskAdjustment', { ...st.riskAdjustment, pct: n }), { min: 0, max: 90 })}
                  <label className={s.num}>
                    Currency
                    <select value={st.currency} onChange={(e) => patch('currency', e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <span className={s.hint}>Comparable multiples and earnings are in this currency.</span>
                  </label>
                </div>
              </div>
            </Card>
          )}
          {has('preview') && (
            <Card icon={<BarChart3 size={20} />} title="Test Calculation" sub="Run the published methodology against a live domain.">
              <label className={s.num}>
                Test Domain
                <span style={{ display: 'flex', gap: 8 }}>
                  <input style={{ textAlign: 'left' }} value={testDomain} onChange={(e) => setTestDomain(e.target.value)} maxLength={253} />
                  <Button size="sm" icon={<Play size={14} />} onClick={runTest} disabled={testing || !testDomain.trim()}>
                    {testing ? 'Running…' : 'Run'}
                  </Button>
                </span>
                <span className={s.hint}>Tests use the published version{dirty ? ' — publish your changes first to test them' : ''}. Test runs never count against limits.</span>
              </label>
              <div className={s.preview}>
                {preview?.status === 'completed' ? (
                  <>
                    <div>
                      <small>Quality score · {preview.confidence ?? 'LOW'} confidence</small>
                      <div className={s.big}>{preview.qualityScore ?? '—'}</div>
                      <small>{preview.monetaryRange ? `${money(preview.monetaryRange.low, preview.monetaryRange.currency)} – ${money(preview.monetaryRange.high, preview.monetaryRange.currency)}` : 'Insufficient evidence for a monetary valuation'}</small>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className={s.big}>{preview.evidenceCoveragePct ?? 0}%</div>
                      <small>Evidence coverage</small>
                    </div>
                  </>
                ) : preview?.status === 'failed' ? (
                  <span style={{ color: 'var(--red)' }}>{preview.error ?? 'The test failed.'}</span>
                ) : (
                  <span className={s.hint}>{testing ? `Analyzing ${testDomain}… ${preview ? `(${preview.status})` : ''}` : 'Run a test to see the score for a domain.'}</span>
                )}
              </div>
              <b style={{ fontSize: 14 }}>Category Scores {preview?.breakdown ? '(test result)' : '(current weights)'}</b>
              {CATEGORIES.map((c) => {
                const row = preview?.breakdown?.find((b) => b.category === c);
                const v = row ? (row.score ?? 0) : st.weights[c];
                return (
                  <div key={c} className={s.row}>
                    <span style={{ flex: '0 0 40%' }}>{payload.categoryLabels[c]}</span>
                    <div className={s.bar} style={{ flex: 1 }}>
                      <i style={{ width: `${v}%`, background: COLORS[c] }} />
                    </div>
                    <span style={{ width: 54, textAlign: 'right' }}>{row ? (row.score === null ? 'n/a' : row.score) : `${v}%`}</span>
                  </div>
                );
              })}
              {tests[0] && (
                <p className={s.hint} style={{ marginTop: 8 }}>
                  <Link href={`/admin/valuation/history/${tests[0].id}`} style={{ color: 'var(--blue)' }}>
                    Open the latest test with full evidence →
                  </Link>
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      {has('comparables') && (
        <Card
          icon={<Scale size={20} />}
          title="2. Comparable Transactions"
          sub="Dated sale multiples (× trailing-twelve-month earnings). Without a current comparable for the business model, reports show “Insufficient evidence for a monetary valuation”."
          right={
            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => patch('comparables', [...st.comparables, { id: `c${Date.now().toString(36)}`, label: '', businessModel: 'content', multipleLow: 2, multipleHigh: 3, observedAt: today(), source: '' }])}>
              Add Comparable
            </Button>
          }
        >
          {num('Maximum comparable age (months)', st.comparableMaxAgeMonths, (n) => patch('comparableMaxAgeMonths', n), { min: 1, max: 120, hint: 'Older comparables are ignored automatically.' })}
          {st.comparables.length === 0 ? (
            <p className={s.hint}>No comparables yet, so no report will show a dollar range.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Business model</th>
                    <th>Multiple low</th>
                    <th>Multiple high</th>
                    <th>Observed</th>
                    <th>Source</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {st.comparables.map((c, i) => {
                    const stale = monthsAgo(c.observedAt) > st.comparableMaxAgeMonths;
                    return (
                      <tr key={c.id}>
                        <td>
                          <input className={s.cell} value={c.label} onChange={(e) => setComp(i, { label: e.target.value })} maxLength={120} aria-label="Label" placeholder="e.g. Content sites H1 2026" />
                        </td>
                        <td>
                          <select className={s.cell} value={c.businessModel} onChange={(e) => setComp(i, { businessModel: e.target.value })} aria-label="Business model">
                            <option value="any">Any model</option>
                            {BUSINESS_MODELS.map((m) => (
                              <option key={m} value={m}>
                                {BUSINESS_MODEL_LABEL[m]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input className={s.cell} type="number" min={0.1} max={100} step={0.1} value={c.multipleLow} onChange={(e) => setComp(i, { multipleLow: clampNum(e.target.value, 0, 100) })} aria-label="Multiple low" />
                        </td>
                        <td>
                          <input className={s.cell} type="number" min={0.1} max={100} step={0.1} value={c.multipleHigh} onChange={(e) => setComp(i, { multipleHigh: clampNum(e.target.value, 0, 100) })} aria-label="Multiple high" />
                        </td>
                        <td>
                          <input className={s.cell} type="date" value={c.observedAt} max={today()} onChange={(e) => setComp(i, { observedAt: e.target.value })} aria-label="Observed date" />
                          {stale && <span className={`${s.badge} ${s.amber}`}>Too old</span>}
                        </td>
                        <td>
                          <input className={s.cell} value={c.source} onChange={(e) => setComp(i, { source: e.target.value })} maxLength={200} aria-label="Source" placeholder="Broker report / marketplace" />
                        </td>
                        <td>
                          <button type="button" className={s.iconBtn} onClick={() => patch('comparables', st.comparables.filter((_, j) => j !== i))} aria-label="Remove comparable">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!compsOk && <div className={s.bad}>Every comparable needs a label, a source, a date and a high multiple at least as large as the low one.</div>}
        </Card>
      )}

      {has('sources') && (
        <Card icon={<Database size={20} />} title="3. Evidence Sources" sub="Enable or disable sources. Each signal is stored with its provenance class.">
          {(sources.length ? sources : SOURCES.map((k) => ({ key: k, label: payload.sourceLabels[k], enabled: st.sources[k], configured: true, note: '', classification: '', requests30d: 0, lastSync: null }))).map((x) => (
            <div key={x.key} className={s.row} style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {x.label}
                  {x.classification && <span className={`${s.badge} ${s.gray}`}>{x.classification}</span>}
                  {!x.configured && <span className={`${s.badge} ${s.amber}`}>Not configured</span>}
                </b>
                <span className={s.hint} style={{ display: 'block' }}>
                  {x.note}
                  {x.key !== 'crawler' && sources.length > 0 && ` · ${x.requests30d.toLocaleString('en-US')} requests in 30 days${x.lastSync ? ` · last ${formatDateTime(x.lastSync)}` : ''}`}
                </span>
              </div>
              <Toggle label={`Use ${x.label}`} checked={st.sources[x.key]} onChange={(v) => patch('sources', { ...st.sources, [x.key]: v })} disabled={x.key === 'crawler'} />
            </div>
          ))}
          <div className={s.two} style={{ marginTop: 14 }}>
            {num('PageSpeed cache (hours)', st.cacheHours.pagespeed, (n) => patch('cacheHours', { ...st.cacheHours, pagespeed: n }), { min: 1, max: 720 })}
            {num('Rankings cache (hours)', st.cacheHours.rankings, (n) => patch('cacheHours', { ...st.cacheHours, rankings: n }), { min: 1, max: 2160 })}
            {num('RDAP cache (hours)', st.cacheHours.rdap, (n) => patch('cacheHours', { ...st.cacheHours, rdap: n }), { min: 1, max: 4320 })}
            {num('Crawler cache (hours)', st.cacheHours.crawler, (n) => patch('cacheHours', { ...st.cacheHours, crawler: n }), { min: 1, max: 720 })}
          </div>
        </Card>
      )}

      {has('access') && (
        <Card icon={<Users size={20} />} title="4. Access, Limits & Credits" sub="Who can run estimates and enhanced valuations, and how often.">
          <div className={s.tabs} role="tablist">
            {(
              [
                ['plans', 'Plan Access'],
                ['limits', 'Limits & Credits'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={accessTab === k} onClick={() => setAccessTab(k)}>
                {l}
              </button>
            ))}
          </div>
          {accessTab === 'plans' ? (
            planRows.map((p) => (
              <div key={p.code} className={s.row}>
                <span>{p.name}</span>
                <select value={st.access[p.code] ?? (p.code === 'free' ? 'public' : 'enhanced')} onChange={(e) => patch('access', { ...st.access, [p.code]: e.target.value as AccessLevel })} aria-label={`${p.name} access`}>
                  {(Object.keys(ACCESS_LABELS) as AccessLevel[]).map((a) => (
                    <option key={a} value={a}>
                      {ACCESS_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
            ))
          ) : (
            <div className={s.two}>
              {num('Anonymous estimates per IP / day', st.limits.anonymousPerDay, (n) => patch('limits', { ...st.limits, anonymousPerDay: n }), { min: 0, max: 1000 })}
              {num('Anonymous estimates per domain / day', st.limits.anonymousPerDomainPerDay, (n) => patch('limits', { ...st.limits, anonymousPerDomainPerDay: n }), { min: 0, max: 1000 })}
              {num('Signed-in valuations per month', st.limits.userPerMonth, (n) => patch('limits', { ...st.limits, userPerMonth: n }), { min: 0, max: 100000 })}
              {num('PDF downloads per workspace / month', st.limits.pdfPerMonth, (n) => patch('limits', { ...st.limits, pdfPerMonth: n }), { min: 0, max: 100000 })}
              {num('Credits per enhanced valuation', st.enhancedCredits, (n) => patch('enhancedCredits', n), { min: 0, max: 1000, hint: 'Reserved on submit, settled on success, released on failure or cancel.' })}
            </div>
          )}
        </Card>
      )}

      {has('calculator') && (
        <Card icon={<Settings2 size={20} />} title="Public Calculator" sub="How the free calculator on /website-value behaves.">
          <div className={s.row}>
            <span>Calculator enabled</span>
            <Toggle label="Calculator enabled" checked={st.calculator.enabled} onChange={(v) => patch('calculator', { ...st.calculator, enabled: v })} />
          </div>
          <div className={s.two} style={{ marginTop: 12 }}>
            <label className={s.num}>
              Search market
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
            <label className={s.num}>
              Consent version
              <input type="date" style={{ textAlign: 'left' }} value={st.consentVersion} onChange={(e) => patch('consentVersion', e.target.value)} />
              <span className={s.hint}>Change it when the data-collection terms change; clients must send the current version.</span>
            </label>
            {num('Result lifetime (days)', st.resultTtlDays, (n) => patch('resultTtlDays', n), { min: 1, max: 365, hint: 'Completed results are marked expired after this.' })}
          </div>
        </Card>
      )}

      {has('templates') && (
        <Card icon={<FileText size={20} />} title="Report Disclaimer" sub="Shown on every report and PDF.">
          <label className={s.num}>
            Disclaimer
            <textarea className={s.textarea} value={st.disclaimer} maxLength={2000} rows={5} onChange={(e) => patch('disclaimer', e.target.value)} />
            <span className={s.hint}>{st.disclaimer.length}/2000</span>
          </label>
        </Card>
      )}

      {has('history') && (
        <Card icon={<Clock size={20} />} title="5. Versions & Tests" sub="Published methodology versions are append-only.">
          <div className={s.tabs} role="tablist">
            {(
              [
                ['versions', 'Version History'],
                ['tests', 'Test Runs'],
                ['formula', 'Formula'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={historyTab === k} onClick={() => setHistoryTab(k)}>
                {l}
              </button>
            ))}
          </div>
          {historyTab === 'versions' ? (
            payload.versions.length === 0 ? (
              <p className={s.hint}>Using the built-in defaults (v1.0.0). Publishing a change records both versions.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Effective</th>
                      <th>Approved by</th>
                      <th>Note</th>
                      <th>Checksum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.versions.map((v) => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 700 }}>
                          {v.version} {v.current && <span className={s.badge}>Current</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(v.effectiveAt)}</td>
                        <td>{v.approver}</td>
                        <td>{v.note ?? '—'}</td>
                        <td>
                          <code title={v.checksum}>{v.checksum.slice(0, 10)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : historyTab === 'tests' ? (
            tests.length === 0 ? (
              <p className={s.hint}>No test calculations yet.</p>
            ) : (
              tests.slice(0, 10).map((t) => (
                <div key={t.id} className={s.row}>
                  <Link href={`/admin/valuation/history/${t.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                    {t.domain}
                  </Link>
                  <span className={s.hint}>
                    {formatDateTime(t.createdAt)} · {t.status.toLowerCase()} · score {t.qualityScore ?? '—'} · {t.methodologyVersion}
                  </span>
                </div>
              ))
            )
          ) : (
            <div className={s.formula}>
              <p>
                <code>quality = Σ(weightᵢ × scoreᵢ) / Σ weightᵢ</code> over categories with evidence; withheld when their weights cover less than <code>{st.minEvidencePct}%</code>.
              </p>
              <p>
                <code>range = TTM earnings × [multiple low, multiple high]</code> of the newest comparable for the business model (≤ {st.comparableMaxAgeMonths} months old), reduced by {st.riskAdjustment.pct}% when quality &lt; {st.riskAdjustment.belowScore}. Missing earnings or comparables: “Insufficient evidence for a monetary valuation”.
              </p>
              <p>Confidence: LOW by default; MEDIUM with verified traffic (GA4 or Search Console) + self-reported financials + a current comparable. HIGH is not offered in V1.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
