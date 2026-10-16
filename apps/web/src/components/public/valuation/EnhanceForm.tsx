'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowRight, BarChart3, Check, CircleDollarSign, Lock, Target } from 'lucide-react';
import { apiAction } from '@/lib/actions';
import { previewValuation, verifyValuation } from '@/lib/public-actions';
import { BUSINESS_MODEL_LABEL, BUSINESS_MODELS, money, reportHref } from '@/lib/valuation';
import { Gauge } from './Charts';
import site from '../site.module.css';
import s from './valuation.module.css';

type Property = { id: string; name: string };
export type GoogleState = {
  /** false = Google integrations not configured on this server. */
  available: boolean;
  connectionId: string | null;
  account: string | null;
  properties: Property[];
};

type Range = { low: number; high: number; currency: string } | null;

type Props = {
  valuationId: string;
  shareToken: string;
  domain: string;
  current: { qualityScore: number | null; confidence: string; range: Range };
  consentVersion: string;
  credits: number;
  signedIn: boolean;
  workspaceId: string | null;
  ga4: GoogleState;
  gsc: GoogleState;
};

type Preview = { qualityScore: number | null; confidence: string; monetaryRange: Range; limitations: string[] };

const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/[, ]/g, '')));
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);
const range = (r: Range | undefined) => (r ? `${money(r.low, r.currency)} – ${money(r.high, r.currency)}` : 'No dollar range');

/** "Connect Your Data for a More Accurate Valuation" — enhanced valuation inputs (V1 manual §06). */
export function EnhanceForm({ valuationId, shareToken, domain, current, consentVersion, credits, signedIn, workspaceId, ga4, gsc }: Props) {
  const router = useRouter();
  const here = `/website-value/report/${valuationId}/enhance?t=${encodeURIComponent(shareToken)}`;
  const [ga4Prop, setGa4Prop] = useState(ga4.properties[0]?.id ?? '');
  const [gscProp, setGscProp] = useState(gsc.properties.find((p) => p.id.includes(domain))?.id ?? gsc.properties[0]?.id ?? '');
  const [f, setF] = useState({ ttmRevenue: '', ttmExpenses: '', ttmProfit: '', businessModel: '' });
  const [agree, setAgree] = useState(false);
  const [assume, setAssume] = useState(false);
  // One idempotency key per page visit: a retried submit never starts (or charges for) a second job.
  const [idemKey] = useState(newKey);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const useGa4 = !!(ga4.connectionId && ga4Prop);
  const useGsc = !!(gsc.connectionId && gscProp);
  const financial = useMemo(
    () =>
      Object.fromEntries(Object.entries({ ttmRevenue: num(f.ttmRevenue), ttmExpenses: num(f.ttmExpenses), ttmProfit: num(f.ttmProfit), businessModel: f.businessModel || undefined }).filter(([, v]) => v !== undefined)) as {
        ttmRevenue?: number;
        ttmExpenses?: number;
        ttmProfit?: number;
        businessModel?: string;
      },
    [f.ttmRevenue, f.ttmExpenses, f.ttmProfit, f.businessModel],
  );
  const invalid = [financial.ttmRevenue, financial.ttmExpenses].some((v) => v !== undefined && (!Number.isFinite(v) || v < 0)) || (financial.ttmProfit !== undefined && !Number.isFinite(financial.ttmProfit));
  const financialGiven = financial.ttmRevenue !== undefined || financial.ttmProfit !== undefined;
  const ready = useGa4 || useGsc || financialGiven;

  useEffect(() => {
    if (invalid) return;
    const planned = [useGa4 && 'ga4', useGsc && 'gsc'].filter(Boolean) as string[];
    const t = setTimeout(async () => {
      const r = await previewValuation(valuationId, shareToken, financial, planned);
      if (r.ok) setPreview(r.data);
    }, 400);
    return () => clearTimeout(t);
  }, [financial, useGa4, useGsc, valuationId, shareToken, invalid]);

  const connect = (provider: 'google_analytics' | 'google_search_console') =>
    start(async () => {
      if (!workspaceId) return setError('You need a workspace before connecting Google.');
      const r = await apiAction<{ url: string }>('POST', `/user/workspaces/${workspaceId}/integrations/google/start`, { provider, returnTo: here });
      if (!r.ok) return setError(r.message);
      window.location.assign(r.data.url);
    });

  const statusRow = (icon: React.ReactNode, label: string, state: string, ok: boolean) => (
    <div className={s.srcRow} key={label}>
      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {icon} {label}
      </span>
      <small style={{ color: ok ? '#15803d' : 'var(--mute)' }}>● {state}</small>
    </div>
  );

  const google = (key: 'ga4' | 'gsc', g: GoogleState, value: string, onChange: (v: string) => void) => {
    const provider = key === 'ga4' ? 'google_analytics' : 'google_search_console';
    const label = key === 'ga4' ? 'Connect Google Analytics 4' : 'Connect Google Search Console';
    if (!signedIn) {
      return (
        <Link href={`/login?next=${encodeURIComponent(here)}`} className={s.gbtn}>
          <span className={s.g}>G</span> {label}
        </Link>
      );
    }
    if (!g.available) return <p style={{ fontSize: 13, color: 'var(--mute)' }}>Google connections are not configured on this server yet.</p>;
    if (!g.connectionId) {
      return (
        <button type="button" className={s.gbtn} onClick={() => connect(provider)} disabled={pending}>
          <span className={s.g}>G</span> {label}
        </button>
      );
    }
    return (
      <label className={s.field}>
        <span>
          Connected as {g.account ?? 'Google account'} · choose the {key === 'ga4' ? 'GA4 property' : 'Search Console site'}
        </span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Don’t use</option>
          {g.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const submit = () =>
    start(async () => {
      setError(null);
      if (!signedIn) return router.push(`/login?next=${encodeURIComponent(here)}`);
      if (invalid) return setError('Revenue and expenses must be positive numbers.');
      if (financialGiven && !financial.businessModel) return setError('Select a business model so comparable multiples can be applied.');
      if (!agree) return setError('Please confirm the data-access consent.');
      if (financialGiven && !assume) return setError('Please confirm the self-reported figures.');
      const inputs: Record<string, unknown> = { consentVersion, idempotencyKey: idemKey };
      if (Object.keys(financial).length) inputs.financial = financial;
      if (financialGiven) inputs.acceptAssumptions = true;
      if (useGa4) inputs.ga4 = { integrationId: ga4.connectionId, propertyId: ga4Prop };
      if (useGsc) inputs.gsc = { integrationId: gsc.connectionId, siteUrl: gscProp };
      const r = await verifyValuation(valuationId, shareToken, inputs);
      if (!r.ok) return setError(r.message);
      router.push(reportHref(r.data.id, r.data.shareToken));
    });

  return (
    <div className={s.wrap}>
      <div className={s.connector} style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span className={s.stepNum}>1</span>
            <div>
              <h2 style={{ fontSize: 22, margin: 0 }}>Connect Your Data Sources</h2>
              <p style={{ color: 'var(--mute)', fontSize: 14 }}>Link your accounts to use verified traffic and search data.</p>
            </div>
          </div>
          {(
            [
              ['ga4', 'Google Analytics 4 (GA4)', 'Connect your GA4 property for verified sessions, users and traffic trends.', ['Verified sessions and users', 'Traffic trends over 12 months', 'Engagement', 'Referral and social traffic'], ga4, ga4Prop, setGa4Prop],
              ['gsc', 'Google Search Console', 'Connect Search Console for verified clicks, impressions and positions.', ['Clicks and impressions (28 days)', 'Pages with search impressions', 'Click-through rate (CTR)', 'Average search position'], gsc, gscProp, setGscProp],
            ] as const
          ).map(([key, title, text, gets, g, value, onChange]) => (
            <section key={key} className={s.panel}>
              <div className={s.connector}>
                <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                  <h3 style={{ display: 'flex', gap: 10, alignItems: 'center', margin: 0, flexWrap: 'wrap' }}>
                    {title} <span className={s.pill}>Recommended</span>
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--ink2)' }}>{text}</p>
                  {google(key, g, value, onChange)}
                </div>
                <div className={s.whatWeGet}>
                  <b>What we get from {key === 'ga4' ? 'GA4' : 'Search Console'}</b>
                  <ul className={s.list} style={{ fontSize: 13 }}>
                    {gets.map((t) => (
                      <li key={t}>
                        <Check size={16} className={s.okIcon} /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ))}

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10 }}>
            <span className={s.stepNum}>2</span>
            <div>
              <h2 style={{ fontSize: 22, margin: 0 }}>Add Business Information (Optional)</h2>
              <p style={{ color: 'var(--mute)', fontSize: 14 }}>A dollar range needs your trailing-twelve-month (TTM) earnings and business model.</p>
            </div>
          </div>
          <div className={s.grid2}>
            <section className={s.panel} style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <CircleDollarSign size={20} color="#15803d" /> Earnings (Last 12 Months)
              </h3>
              <p style={{ fontSize: 13, color: 'var(--mute)' }}>Enter revenue and expenses, or your net profit. These are recorded as self-reported.</p>
              <div className={s.grid2} style={{ gap: 10 }}>
                <label className={s.field}>
                  TTM Revenue (USD)
                  <input inputMode="numeric" placeholder="e.g. 120,000" value={f.ttmRevenue} onChange={set('ttmRevenue')} />
                </label>
                <label className={s.field}>
                  TTM Expenses (USD)
                  <input inputMode="numeric" placeholder="e.g. 45,000" value={f.ttmExpenses} onChange={set('ttmExpenses')} />
                </label>
              </div>
              <label className={s.field}>
                or TTM Net Profit (USD)
                <input inputMode="numeric" placeholder="e.g. 75,000" value={f.ttmProfit} onChange={set('ttmProfit')} />
              </label>
            </section>
            <section className={s.panel} style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Target size={20} color="#15803d" /> Business Model
              </h3>
              <p style={{ fontSize: 13, color: 'var(--mute)' }}>Used to pick comparable sale multiples for similar websites.</p>
              <label className={s.field}>
                Business Model
                <select value={f.businessModel} onChange={set('businessModel')}>
                  <option value="">Select model</option>
                  {BUSINESS_MODELS.map((o) => (
                    <option key={o} value={o}>
                      {BUSINESS_MODEL_LABEL[o]}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10 }}>
            <span className={s.stepNum}>3</span>
            <div>
              <h2 style={{ fontSize: 22, margin: 0 }}>Review &amp; Confirm</h2>
              <p style={{ color: 'var(--mute)', fontSize: 14 }}>The enhanced valuation is recalculated from your data and stored as a new, immutable result.</p>
            </div>
          </div>
          <section className={s.panel} style={{ display: 'grid', gap: 12 }}>
            <label className={s.checkLine}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I agree to AmpliVerify reading the selected Google Analytics / Search Console data for this valuation (consent version {consentVersion}).</span>
            </label>
            {financialGiven && (
              <label className={s.checkLine}>
                <input type="checkbox" checked={assume} onChange={(e) => setAssume(e.target.checked)} />
                <span>I confirm these figures are accurate to the best of my knowledge and understand they are labelled self-reported and are not independently verified.</span>
              </label>
            )}
            <p style={{ fontSize: 13, color: 'var(--mute)' }}>{credits > 0 ? `This uses ${credits} credit${credits === 1 ? '' : 's'}. Credits are reserved when you submit and returned if the calculation fails or is cancelled.` : 'Enhanced valuations are included in your plan.'}</p>
          </section>
        </div>

        <aside className={s.side}>
          <section className={s.panel} style={{ display: 'grid', gap: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Valuation Preview</h3>
              <p style={{ fontSize: 13, color: 'var(--mute)' }}>See how your data changes the result.</p>
            </div>
            <div className={`${s.previewBox} ${s.muted}`}>
              <div>
                <small>Current (Public Data) · {current.confidence} confidence</small>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{range(current.range)}</div>
              </div>
              {current.qualityScore !== null && <Gauge value={current.qualityScore} size={64} label="Current quality score" />}
            </div>
            <ArrowDown size={18} style={{ margin: '0 auto', color: 'var(--mute)' }} />
            <div className={s.previewBox}>
              <div>
                <small style={{ fontWeight: 700 }}>With Your Data · {preview?.confidence ?? '—'} confidence</small>
                <small style={{ display: 'block', color: 'var(--mute)' }}>Projection — assumes the selected connections succeed</small>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>{preview ? range(preview.monetaryRange) : '—'}</div>
                {preview && !preview.monetaryRange && <small style={{ color: 'var(--mute)' }}>{preview.limitations[1] ?? preview.limitations[0]}</small>}
              </div>
              {preview?.qualityScore != null && <Gauge value={preview.qualityScore} size={76} label="Projected quality score" />}
            </div>
            <div>
              <b style={{ fontSize: 15 }}>Data Source Status</b>
              {statusRow(<BarChart3 size={18} color="#f59e0b" />, 'Google Analytics 4', useGa4 ? 'Selected' : ga4.connectionId ? 'Connected' : 'Not connected', useGa4)}
              {statusRow(<Target size={18} color="#4285f4" />, 'Google Search Console', useGsc ? 'Selected' : gsc.connectionId ? 'Connected' : 'Not connected', useGsc)}
              {statusRow(<CircleDollarSign size={18} color="#15803d" />, 'TTM Earnings', financialGiven ? 'Self-reported' : 'Not provided', financialGiven)}
              {statusRow(<Target size={18} color="#15803d" />, 'Business Model', f.businessModel ? BUSINESS_MODEL_LABEL[f.businessModel] : 'Not provided', !!f.businessModel)}
            </div>
            <div className={s.whatWeGet} style={{ display: 'flex', gap: 12 }}>
              <Lock size={22} color="#15803d" style={{ flex: 'none' }} />
              <div>
                <b>Your Data Stays Private</b>
                <p style={{ fontSize: 12, color: 'var(--ink2)' }}>We only read the data needed for this valuation. We never see your Google password; access tokens are encrypted and you can disconnect anytime.</p>
                <Link href="/legal#privacy" style={{ color: '#15803d', fontSize: 12, fontWeight: 700 }}>
                  Learn more about our data policy →
                </Link>
              </div>
            </div>
            {error && (
              <p role="alert" className={s.calcErr}>
                {error}
              </p>
            )}
            <button type="button" className={site.btn} onClick={submit} disabled={pending || !ready}>
              {pending ? 'Working…' : signedIn ? 'Generate Enhanced Valuation' : 'Sign In to Generate'} <ArrowRight size={18} />
            </button>
            {!ready && <small style={{ color: 'var(--mute)', textAlign: 'center' }}>Connect a data source or add your earnings first.</small>}
            <Link href={reportHref(valuationId, shareToken)} className={site.btnOutline}>
              Continue with Current Estimate
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
