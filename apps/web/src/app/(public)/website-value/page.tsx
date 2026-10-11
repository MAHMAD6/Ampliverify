import Link from 'next/link';
import { AlertTriangle, ArrowRight, BarChart3, Check, Database, FileText, Link2, Search, Settings2, Target, TrendingUp, Zap } from 'lucide-react';
import { CalculatorForm } from '@/components/public/valuation/CalculatorForm';
import { Sparkline } from '@/components/public/valuation/Charts';
import { apiGet } from '@/lib/api';
import type { ValuationConfig } from '@/lib/valuation';
import site from '@/components/public/site.module.css';
import s from '@/components/public/valuation/valuation.module.css';

export const metadata = {
  title: 'Website Value Calculator — Find Out What Your Website Is Worth',
  description: 'Free, data-driven estimate of your website’s value from SEO performance, traffic signals, content, backlinks and technical health.',
};

const STRIP = [
  { icon: <Search size={22} />, title: 'SEO Performance', text: 'Organic traffic and keyword value' },
  { icon: <Link2 size={22} />, title: 'Backlink Profile', text: 'Link quality and domain authority' },
  { icon: <FileText size={22} />, title: 'Content Value', text: 'Content depth and topical relevance' },
  { icon: <Settings2 size={22} />, title: 'Technical Health', text: 'Site structure, speed, and indexing' },
  { icon: <BarChart3 size={22} />, title: 'Market Indicators', text: 'Industry benchmarks and comparables' },
];

/** Illustrative example only: clearly labelled, never presented as a real site's data. */
const EXAMPLE_TREND = [3, 4, 3.6, 5, 5.4, 6.2, 7].map((v, i) => ({ month: `2026-0${i + 1}`, value: v }));

const FAQS = [
  ['How is my website value calculated?', 'We combine organic traffic and its keyword value, backlinks and authority, content depth, technical health, and domain signals. Each factor is weighted, and the result is shown as a range with a confidence score.'],
  ['What data sources are used?', 'Public SEO data (traffic and keyword estimates, backlinks), Google PageSpeed Insights, and public domain registration records. You can connect Google Analytics 4 and Search Console for a verified valuation.'],
  ['Is this calculator free to use?', 'Yes. A limited number of free estimates are included each month without an account. Plans include more valuations, full reports and PDF downloads.'],
  ['Can I get a more detailed report?', 'Yes. Connect your own data from the report page for a verified valuation with higher confidence, or run a full SEO audit for a step-by-step growth plan.'],
];

export default async function WebsiteValuePage() {
  const cfg = await apiGet<ValuationConfig>('/public/valuations/config', { revalidate: 60 });
  const available = cfg.ok && cfg.data.available;
  const reason = !cfg.ok ? 'The calculator is temporarily unavailable.' : !cfg.data.enabled ? 'The Website Value Calculator is currently turned off.' : !cfg.data.available ? 'The calculator is not available yet. Please check back soon.' : undefined;
  return (
    <div className={s.wrap}>
      <section className={site.hero}>
        <div className={`${site.container} ${site.heroGrid}`}>
          <div>
            <div className={site.eyebrow}>Free Website Value Calculator</div>
            <h1 className={site.h1}>Find Out What Your Website Is Worth</h1>
            <p className={site.lead}>Get an instant, data-driven estimate of your website’s value based on SEO performance, traffic signals, content, backlinks, and technical health.</p>
            <div style={{ marginTop: 26 }}>
              <CalculatorForm disabled={!available} disabledReason={reason} />
            </div>
          </div>
          <div className={s.heroCard} aria-label="Example result">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>Estimated Website Value</b>
              <span className={site.sample}>Example</span>
            </div>
            <div className={s.valueBig} style={{ margin: '10px 0 14px' }}>
              $24,500 – $58,000
            </div>
            {[
              ['Organic Traffic', 70],
              ['Backlinks', 55],
              ['Content Value', 45],
              ['Technical Health', 35],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10, alignItems: 'center', fontSize: 13, padding: '6px 0' }}>
                <span>{l}</span>
                <div className={s.bar}>
                  <i style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
            <div className={s.floatTag} style={{ right: -14, top: -18 }}>
              <TrendingUp size={16} color="#15803d" /> Growth Potential
            </div>
            <div className={s.floatTag} style={{ right: -10, bottom: -20 }}>
              <Target size={16} color="#3b5bdb" /> Market Position
            </div>
          </div>
        </div>
      </section>

      <section className={site.strip}>
        <div className={`${site.container} ${site.stripIn}`}>
          {STRIP.map((i) => (
            <div key={i.title} className={site.stripItem}>
              <span className={site.icon}>{i.icon}</span>
              <div>
                <b>{i.title}</b>
                <small>{i.text}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={site.section}>
        <div className={site.container}>
          <div className={site.center}>
            <div className={site.eyebrow}>Sample Results</div>
            <h2 className={site.h2}>See What You’ll Get</h2>
            <p className={site.lead}>Here’s an example of a website valuation report to show the insights you’ll receive.</p>
          </div>
          <div className={s.panel} style={{ marginTop: 30 }} aria-label="Example report with sample data">
            <div className={s.grid2}>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <div className={s.shot} style={{ width: 150, flex: 'none' }}>
                  <Database size={28} />
                </div>
                <div>
                  <div className={s.domain}>example.com</div>
                  <div className={s.metaLine}>Technology · Global</div>
                  <p style={{ marginTop: 12, fontWeight: 700 }}>Estimated Website Value</p>
                  <div className={s.valueBig}>$24,500 – $58,000</div>
                  <p style={{ marginTop: 8, fontSize: 14 }}>
                    Confidence: <b style={{ color: '#15803d' }}>Good</b> · 75%
                  </p>
                  <span className={site.sample}>Sample data</span>
                </div>
              </div>
              <div className={s.grid2} style={{ gap: 12 }}>
                {[
                  ['Organic Traffic', '12.4K', '/ month'],
                  ['Backlinks', '3.8K', 'referring domains'],
                  ['Domain Authority', '42', '/ 100'],
                  ['Content Pages', '320', 'indexed pages'],
                ].map(([l, v, u]) => (
                  <div key={l} className={s.panel} style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                    <div>
                      <small style={{ fontWeight: 700 }}>{l}</small>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
                      <small style={{ color: 'var(--mute)' }}>{u}</small>
                    </div>
                    <Sparkline points={EXAMPLE_TREND} />
                  </div>
                ))}
              </div>
            </div>
            <div className={s.grid3} style={{ marginTop: 18 }}>
              <div className={s.panel}>
                <h3 style={{ fontSize: 17, marginBottom: 10 }}>Value Breakdown</h3>
                {[
                  ['SEO & Organic Traffic', 35],
                  ['Backlinks & Authority', 25],
                  ['Content Value', 20],
                  ['Technical Health', 15],
                  ['Brand & Market Factors', 5],
                ].map(([l, v]) => (
                  <div key={l} className={s.breakRow}>
                    <span>{l}</span>
                    <div className={s.bar}>
                      <i style={{ width: `${(Number(v) / 35) * 100}%` }} />
                    </div>
                    <span>{v}%</span>
                  </div>
                ))}
              </div>
              <div className={s.panel}>
                <h3 style={{ fontSize: 17, marginBottom: 10 }}>Key Value Drivers</h3>
                <ul className={s.list}>
                  {['Strong organic traffic growth', 'Quality backlink profile', 'Relevant, authoritative content', 'Good technical SEO health'].map((t) => (
                    <li key={t}>
                      <Check size={18} className={s.okIcon} /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={s.panel}>
                <h3 style={{ fontSize: 17, marginBottom: 10 }}>Potential Risks</h3>
                <ul className={s.list}>
                  {['Limited brand search volume', 'Moderate content depth', 'High competitor landscape'].map((t) => (
                    <li key={t}>
                      <AlertTriangle size={18} className={s.warnIcon} /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={site.sectionAlt}>
        <div className={site.container}>
          <h2 className={`${site.h2} ${site.center}`}>Why Use AmpliVerify’s Website Value Calculator?</h2>
          <div className={site.grid4} style={{ marginTop: 28 }}>
            {[
              { icon: <Zap size={22} />, title: 'Instant Results', text: 'Get a website value estimate in seconds.' },
              { icon: <Database size={22} />, title: 'Real Data Sources', text: 'Uses trusted SEO and market data.' },
              { icon: <Target size={22} />, title: 'Actionable Insights', text: 'See what drives value and where to improve.' },
              { icon: <TrendingUp size={22} />, title: 'Next Steps', text: 'Turn insights into a full SEO audit and growth plan.' },
            ].map((c) => (
              <div key={c.title} className={site.card}>
                <span className={site.icon}>{c.icon}</span>
                <h3 className={site.cardTitle}>{c.title}</h3>
                <p className={site.cardText}>{c.text}</p>
              </div>
            ))}
          </div>
          <div className={s.dark} style={{ marginTop: 40 }}>
            <div>
              <h2 className={site.h2} style={{ color: '#fff' }}>
                Want a Deeper Analysis?
              </h2>
              <p style={{ fontSize: 17, opacity: 0.9 }}>Run a full SEO audit to get detailed insights, optimization opportunities, and a step-by-step growth plan.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Link href="/signup" className={site.btnWhite}>
                Run Full SEO Audit <ArrowRight size={18} />
              </Link>
              <p style={{ fontSize: 13, marginTop: 8, opacity: 0.8 }}>No credit card required.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={site.section}>
        <div className={site.container}>
          <div className={site.sectionHead}>
            <div>
              <div className={site.eyebrow}>FAQs</div>
              <h2 className={site.h2}>Common Questions</h2>
            </div>
            <Link href="/help" className={`${site.btnOutline} ${site.sm}`}>
              View all FAQs <ArrowRight size={16} />
            </Link>
          </div>
          <div className={site.grid2} style={{ gap: '0 32px' }}>
            {FAQS.map(([q, a]) => (
              <div key={q} className={site.faq} style={{ display: 'block' }}>
                <details>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              </div>
            ))}
          </div>
          {cfg.ok && <p style={{ marginTop: 26, fontSize: 13, color: 'var(--mute)' }}>{cfg.data.disclaimer}</p>}
        </div>
      </section>
    </div>
  );
}
