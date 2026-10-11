'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowRight, BarChart3, Check, CircleDollarSign, FileText, Lock, Target } from 'lucide-react';
import { apiAction } from '@/lib/actions';
import { previewValuation, verifyValuation } from '@/lib/public-actions';
import { AUDIENCES, BUSINESS_MODELS, INDUSTRIES, MARGINS, money, TRAFFIC_SOURCES } from '@/lib/valuation';
import { Gauge } from './Charts';
import site from '../site.module.css';
import s from './valuation.module.css';

type Property = { id: string; name: string };
export type GoogleState = {
  /** null = Google integrations not configured on this server. */
  available: boolean;
  connectionId: string | null;
  account: string | null;
  properties: Property[];
};

type Props = {
  valuationId: string;
  domain: string;
  current: { low: number; high: number; mid: number; currency: string; confidence: number };
  signedIn: boolean;
  workspaceId: string | null;
  ga4: GoogleState;
  gsc: GoogleState;
};

const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/[, ]/g, '')));

/** "Connect Your Data for a More Accurate Valuation" (docs/design/website-value/Enhanced_Valuation_Report). */
export function EnhanceForm({ valuationId, domain, current, signedIn, workspaceId, ga4, gsc }: Props) {
  const router = useRouter();
  const here = `/website-value/report/${valuationId}/enhance`;
  const [ga4Prop, setGa4Prop] = useState(ga4.properties[0]?.id ?? '');
  const [gscProp, setGscProp] = useState(gsc.properties.find((p) => p.id.includes(domain))?.id ?? gsc.properties[0]?.id ?? '');
  const [f, setF] = useState({ monthlyRevenue: '', annualRevenue: '', profitMargin: '', businessModel: '', industry: '', audience: '', monthlyVisits: '', trafficSource: '', notes: '' });
  const [preview, setPreview] = useState<{ valueLow: number; valueHigh: number; confidence: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const useGa4 = !!(ga4.connectionId && ga4Prop);
  const useGsc = !!(gsc.connectionId && gscProp);
  const business = useMemo(
    () => ({ monthlyRevenue: num(f.monthlyRevenue), annualRevenue: num(f.annualRevenue), profitMargin: f.profitMargin || undefined, monthlyVisits: num(f.monthlyVisits) }),
    [f.monthlyRevenue, f.annualRevenue, f.profitMargin, f.monthlyVisits],
  );
  const invalid = Object.values(business).some((v) => typeof v === 'number' && (!Number.isFinite(v) || v < 0));

  useEffect(() => {
    if (invalid) return;
    const planned = [useGa4 && 'ga4', useGsc && 'gsc'].filter(Boolean) as string[];
    const t = setTimeout(async () => {
      const r = await previewValuation(valuationId, Object.fromEntries(Object.entries(business).filter(([, v]) => v !== undefined)), planned);
      if (r.ok) setPreview(r.data);
    }, 400);
    return () => clearTimeout(t);
  }, [business, useGa4, useGsc, valuationId, invalid]);

  const connect = (provider: 'google_analytics' | 'google_search_console') =>
    start(async () => {
      if (!workspaceId) return setError('You need a workspace before connecting Google.');
      const r = await apiAction<{ url: string }>('POST', `/user/workspaces/${workspaceId}/integrations/google/start`, { provider, returnTo: here });
      if (!r.ok) return setError(r.message);
      window.location.assign(r.data.url);
    });

  const statusRow = (icon: React.ReactNode, label: string, state: string, ok: boolean, action: React.ReactNode) => (
    <div className={s.srcRow} key={label}>
      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {icon} {label}
      </span>
      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <small style={{ color: ok ? '#15803d' : 'var(--mute)' }}>● {state}</small>
        {action}
      </span>
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
      if (invalid) return setError('Revenue and visits must be positive numbers.');
      const inputs: Record<string, unknown> = Object.fromEntries(Object.entries({ ...business, businessModel: f.businessModel, industry: f.industry, audience: f.audience, trafficSource: f.trafficSource, notes: f.notes.trim() }).filter(([, v]) => v !== undefined && v !== ''));
      if (useGa4) inputs.ga4 = { integrationId: ga4.connectionId, propertyId: ga4Prop };
      if (useGsc) inputs.gsc = { integrationId: gsc.connectionId, siteUrl: gscProp };
      const r = await verifyValuation(valuationId, inputs);
      if (!r.ok) return setError(r.message);
      router.push(`/website-value/report/${r.data.id}`);
    });

  const revenueGiven = !!(business.monthlyRevenue || business.annualRevenue);
  const detailsGiven = !!(f.businessModel || f.industry || f.audience);
  const visitsGiven = !!business.monthlyVisits;

  return (
    <div className={s.wrap}>
      <div className={s.connector} style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span className={s.stepNum}>1</span>
            <div>
              <h2 style={{ fontSize: 22, margin: 0 }}>Connect Your Data Sources</h2>
              <p style={{ color: 'var(--mute)', fontSize: 14 }}>Link your accounts to use real traffic, search, and performance data.</p>
            </div>
          </div>
          {(
            [
              ['ga4', 'Google Analytics 4 (GA4)', 'Connect your GA4 property to get verified traffic, user engagement, conversions, and social/referral data.', ['Verified traffic and user data', 'Social and referral traffic', 'Engagement and conversions', 'Traffic trends and audience insights'], ga4, ga4Prop, setGa4Prop],
              ['gsc', 'Google Search Console', 'Connect your Search Console to get verified indexing, keyword performance, and search visibility data.', ['Keyword rankings and impressions', 'Pages with search impressions', 'Click-through rates (CTR)', 'Average search position'], gsc, gscProp, setGscProp],
            ] as const
          ).map(([key, title, text, gets, g, value, onChange]) => (
            <section key={key} className={s.panel}>
              <div className={s.connector}>
                <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                  <h3 style={{ display: 'flex', gap: 10, alignItems: 'center', margin: 0 }}>
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
              <p style={{ color: 'var(--mute)', fontSize: 14 }}>Include additional details to further improve valuation accuracy.</p>
            </div>
          </div>
          <div className={s.grid2}>
            <section className={s.panel} style={{ display: 'grid', gap: 12 }}>
              <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <CircleDollarSign size={20} color="#15803d" /> Revenue Information
              </h3>
              <p style={{ fontSize: 13, color: 'var(--mute)' }}>Helps us estimate earning potential and apply appropriate valuation models.</p>
              <div className={s.grid2} style={{ gap: 10 }}>
                <label className={s.field}>
                  Monthly Revenue (USD)
                  <input inputMode="numeric" placeholder="e.g. 5,000" value={f.monthlyRevenue} onChange={set('monthlyRevenue')} />
                </label>
                <label className={s.field}>
                  Annual Revenue (USD)
                  <input inputMode="numeric" placeholder="e.g. 60,000" value={f.annualRevenue} onChange={set('annualRevenue')} />
                </label>
              </div>
              <label className={s.field}>
                Profit Margin (Optional)
                <select value={f.profitMargin} onChange={set('profitMargin')}>
                  <option value="">Select range</option>
                  {MARGINS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </section>
            <section className={s.panel} style={{ display: 'grid', gap: 12 }}>
              <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Target size={20} color="#15803d" /> Business Details
              </h3>
              <p style={{ fontSize: 13, color: 'var(--mute)' }}>Tell us more about your website and business model.</p>
              {(
                [
                  ['businessModel', 'Business Model', 'Select model', BUSINESS_MODELS],
                  ['industry', 'Industry', 'Select industry', INDUSTRIES],
                  ['audience', 'Target Audience', 'Select audience', AUDIENCES],
                ] as const
              ).map(([k, l, ph, opts]) => (
                <label key={k} className={s.field}>
                  {l}
                  <select value={f[k]} onChange={set(k)}>
                    <option value="">{ph}</option>
                    {opts.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ))}
            </section>
            <section className={s.panel} style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <BarChart3 size={20} color="#15803d" /> Traffic Confirmation
              </h3>
              <p style={{ fontSize: 13, color: 'var(--mute)' }}>Adjust estimated traffic if you have more accurate numbers.</p>
              <div className={s.grid2} style={{ gap: 10 }}>
                <label className={s.field}>
                  Monthly Visits (Optional)
                  <input inputMode="numeric" placeholder="e.g. 25,000" value={f.monthlyVisits} onChange={set('monthlyVisits')} />
                </label>
                <label className={s.field}>
                  Source
                  <select value={f.trafficSource} onChange={set('trafficSource')}>
                    <option value="">Select source</option>
                    {TRAFFIC_SOURCES.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            <section className={s.panel} style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <FileText size={20} color="#15803d" /> Additional Information
              </h3>
              <p style={{ fontSize: 13, color: 'var(--mute)' }}>Any other details that may impact value.</p>
              <label className={s.field}>
                Additional notes (Optional)
                <textarea maxLength={500} placeholder="e.g. monetization methods, partnerships, unique assets, etc." value={f.notes} onChange={set('notes')} />
                <small style={{ textAlign: 'right', color: 'var(--mute)', fontWeight: 400 }}>{f.notes.length}/500</small>
              </label>
            </section>
          </div>
        </div>

        <aside className={s.side}>
          <section className={s.panel} style={{ display: 'grid', gap: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Valuation Preview</h3>
              <p style={{ fontSize: 13, color: 'var(--mute)' }}>See how connecting your data can improve accuracy.</p>
            </div>
            <div className={`${s.previewBox} ${s.muted}`}>
              <div>
                <small>Current Estimate (Public Data)</small>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {money(current.low, current.currency)} – {money(current.high, current.currency)}
                </div>
              </div>
              <Gauge value={current.confidence} size={64} label="Current confidence" />
            </div>
            <ArrowDown size={18} style={{ margin: '0 auto', color: 'var(--mute)' }} />
            <div className={s.previewBox}>
              <div>
                <small style={{ fontWeight: 700 }}>With Your Connected Data</small>
                <small style={{ display: 'block', color: 'var(--mute)' }}>Estimated range based on your data sources</small>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>{preview ? `${money(preview.valueLow, preview.currency)} – ${money(preview.valueHigh, preview.currency)}` : '—'}</div>
                <small style={{ color: 'var(--mute)' }}>Final figures are calculated from your actual data.</small>
              </div>
              {preview && <Gauge value={preview.confidence} size={76} label="Projected confidence" />}
            </div>
            <div>
              <b style={{ fontSize: 15 }}>Data Source Status</b>
              {statusRow(<BarChart3 size={18} color="#f59e0b" />, 'Google Analytics 4', useGa4 ? 'Selected' : ga4.connectionId ? 'Connected' : 'Not connected', useGa4, null)}
              {statusRow(<Target size={18} color="#4285f4" />, 'Google Search Console', useGsc ? 'Selected' : gsc.connectionId ? 'Connected' : 'Not connected', useGsc, null)}
              {statusRow(<CircleDollarSign size={18} color="#15803d" />, 'Revenue Information', revenueGiven ? 'Provided' : 'Not provided', revenueGiven, null)}
              {statusRow(<Target size={18} color="#15803d" />, 'Business Details', detailsGiven ? 'Provided' : 'Not provided', detailsGiven, null)}
              {statusRow(<BarChart3 size={18} color="#15803d" />, 'Traffic Confirmation', visitsGiven ? 'Provided' : 'Not provided', visitsGiven, null)}
            </div>
            <div className={s.whatWeGet} style={{ display: 'flex', gap: 12 }}>
              <Lock size={22} color="#15803d" style={{ flex: 'none' }} />
              <div>
                <b>Your Data Stays Private</b>
                <p style={{ fontSize: 12, color: 'var(--ink2)' }}>We only access the data needed for analysis. We never see your Google password; access tokens are encrypted and you can disconnect anytime.</p>
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
            <button type="button" className={site.btn} onClick={submit} disabled={pending || (!useGa4 && !useGsc && !revenueGiven && !visitsGiven)}>
              {pending ? 'Working…' : signedIn ? 'Generate Verified Valuation' : 'Sign In to Generate'} <ArrowRight size={18} />
            </button>
            {!useGa4 && !useGsc && !revenueGiven && !visitsGiven && <small style={{ color: 'var(--mute)', textAlign: 'center' }}>Connect a data source or add revenue or traffic details first.</small>}
            <Link href={`/website-value/report/${valuationId}`} className={site.btnOutline}>
              Continue with Current Estimate
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
