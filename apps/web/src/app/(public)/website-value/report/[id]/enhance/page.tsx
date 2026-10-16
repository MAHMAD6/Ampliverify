import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3, Check, ChevronRight, Clock, Flag, Lock, ShieldCheck } from 'lucide-react';
import { EnhanceForm, type GoogleState } from '@/components/public/valuation/EnhanceForm';
import { apiGet } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { getAppContext } from '@/lib/project';
import { reportHref, type ValuationReport } from '@/lib/valuation';
import site from '@/components/public/site.module.css';
import s from '@/components/public/valuation/valuation.module.css';

export const metadata = { title: 'Improve Your Website Valuation', robots: { index: false } };

type Connection = { id: string; status: string; account: string | null };
type ProviderRow = { key: string; available: boolean; connections: Connection[] };

async function googleState(rows: ProviderRow[] | null, key: string): Promise<GoogleState> {
  const row = rows?.find((p) => p.key === key);
  const c = row?.connections.find((x) => x.status === 'CONNECTED') ?? null;
  const props = c ? await apiGet<{ id: string; name: string }[]>(`/user/integrations/${c.id}/properties`, { auth: true }) : null;
  return { available: !!row?.available, connectionId: c?.id ?? null, account: c?.account ?? null, properties: props?.ok ? props.data : [] };
}

export default async function EnhanceValuationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const q = t && /^[\w-]{10,64}$/.test(t) ? `?t=${encodeURIComponent(t)}` : '';
  const signedIn = !!(await getAccessToken());
  let res = await apiGet<ValuationReport>(`${signedIn ? '/user' : '/public'}/valuations/${id}${q}`, { auth: signedIn, revalidate: 0 });
  if (signedIn && !res.ok && res.reason === 'not_found' && q) res = await apiGet<ValuationReport>(`/public/valuations/${id}${q}`, { revalidate: 0 });
  if (!res.ok || res.data.mode !== 'public' || res.data.status !== 'completed') notFound();
  const v = res.data;
  let workspaceId: string | null = null;
  let rows: ProviderRow[] | null = null;
  if (signedIn) {
    workspaceId = (await getAppContext()).workspaceId;
    const list = workspaceId ? await apiGet<ProviderRow[]>(`/user/workspaces/${workspaceId}/integrations`, { auth: true }) : null;
    rows = list?.ok ? list.data : null;
  }
  const [ga4, gsc] = await Promise.all([googleState(rows, 'google_analytics'), googleState(rows, 'google_search_console')]);

  return (
    <div className={s.wrap}>
      <section className={site.hero} style={{ paddingBottom: 40 }}>
        <div className={`${site.container} ${site.heroGrid}`}>
          <div>
            <nav className={site.crumbs} aria-label="Breadcrumb" style={{ color: 'var(--mute)', marginBottom: 14 }}>
              <Link href="/">Home</Link> › <Link href="/blog">Resources</Link> › <Link href="/website-value">Website Value Calculator</Link> › <Link href={reportHref(id, v.shareToken)}>Report</Link> › <span>Enhance Valuation</span>
            </nav>
            <div className={site.eyebrow}>Enhanced Valuation</div>
            <h1 className={site.h1}>Connect Your Data for a More Accurate Valuation</h1>
            <p className={site.lead}>Add your own data sources to get an enhanced valuation for {v.domain} with verified traffic, higher confidence and — with your earnings — a dollar range.</p>
            <div className={site.checks} style={{ gap: 26 }}>
              {[
                [<BarChart3 key="a" size={18} />, 'Higher Accuracy', 'Uses your real data'],
                [<ShieldCheck key="b" size={18} />, 'Deeper Insights', 'See what drives value'],
                [<Clock key="c" size={18} />, 'More Opportunities', 'Discover growth areas'],
                [<Lock key="d" size={18} />, 'Your Data Stays Private', 'Read our data policy'],
              ].map(([icon, t, sub]) => (
                <span key={String(t)} style={{ alignItems: 'flex-start' }}>
                  <span className={s.ico} style={{ width: 32, height: 32 }}>
                    {icon}
                  </span>
                  <span>
                    <b style={{ display: 'block', fontSize: 14, color: 'var(--navy)' }}>{t}</b>
                    <small>{sub}</small>
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className={s.heroCard}>
            <small>From Estimate</small>
            <h3 style={{ marginTop: 2 }}>to Enhanced Value</h3>
            <ul className={s.list} style={{ marginTop: 12 }}>
              {['Connect GA4', 'Connect Search Console', 'Add TTM Earnings', 'Get an Enhanced Valuation'].map((t) => (
                <li key={t}>
                  <Check size={18} className={s.okIcon} /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className={site.container} style={{ padding: '36px 0 24px' }}>
        <EnhanceForm valuationId={id} shareToken={v.shareToken} domain={v.domain} current={{ qualityScore: v.qualityScore, confidence: v.confidence ?? 'LOW', range: v.monetaryRange }} consentVersion={v.consentVersion} credits={v.enhancedCredits} signedIn={signedIn} workspaceId={workspaceId} ga4={ga4} gsc={gsc} />
      </div>

      <div className={site.container} style={{ paddingBottom: 64 }}>
        <section className={s.panel}>
          <h3 style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '0 0 6px' }}>
            <Flag size={20} color="#15803d" /> What Happens Next?
          </h3>
          <p style={{ fontSize: 14, color: 'var(--mute)', marginBottom: 16 }}>Once you connect your data and provide additional information, we will:</p>
          <div className={s.nextSteps}>
            {[
              ['Verify your data', 'Securely connect and validate your accounts.'],
              ['Recalculate valuation', 'Use your real data for higher accuracy.'],
              ['Update your report', 'Get an enhanced report with deeper insights.'],
              ['Discover opportunities', 'See personalized growth recommendations.'],
            ].map(([t, d], i) => (
              <div key={t}>
                <span className={s.stepNum} style={{ background: '#e4f5e8', color: '#0e5e2b' }}>
                  {i + 1}
                </span>
                <span>
                  <b>{t}</b>
                  <small>{d}</small>
                </span>
                {i < 3 && <ChevronRight size={18} color="#b5c0ca" style={{ marginLeft: 'auto', flex: 'none' }} />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
