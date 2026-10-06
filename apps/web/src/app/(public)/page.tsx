import Link from 'next/link';
import { ArrowRight, BarChart3, Check, FileText, Link2, Lock, RefreshCw, Search, Settings2, Sparkles, Target, PenSquare } from 'lucide-react';
import { CtaBand, Checks, LearnMore } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata = { title: { absolute: 'AmpliVerify — Turn Your Website Into a Growth Engine' } };

const STEPS = [
  { title: 'Connect Your Website', text: 'Add your website and connect available data sources.', icon: <Link2 size={30} /> },
  { title: 'Audit & Analyze', text: 'Website Audit checks technical health, content and search performance.', icon: <Search size={30} /> },
  { title: 'Optimize', text: 'Get prioritized recommendations and improve pages with guidance.', icon: <Settings2 size={30} /> },
  { title: 'Monitor & Verify', text: 'Track performance and search visibility to verify results.', icon: <BarChart3 size={30} /> },
  { title: 'Improve Continuously', text: 'Refine your strategy and scale what works for long-term growth.', icon: <RefreshCw size={30} /> },
];

/**
 * Home (public-website-v2/01-Home). Product illustrations are labelled
 * "Sample data" exactly as in the design. Customer logos and the case study
 * are omitted until real, approved customers exist.
 */
export default function HomePage() {
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.heroGrid}`}>
          <div>
            <span className={s.badge}>New · Optimize for AI search with GEO</span>
            <h1 className={s.h1}>
              Turn Your Website Into a <span className={s.green}>Growth Engine</span>
            </h1>
            <p className={s.lead}>AmpliVerify helps you audit, optimize, and verify your website&apos;s SEO — for search engines and AI search — so you can improve visibility, attract the right visitors, and drive sustainable growth.</p>
            <form action="/signup" className={s.searchBar} style={{ margin: '26px 0 0' }}>
              <input name="website" placeholder="yourwebsite.com" aria-label="Your website address" />
              <button type="submit" className={s.btn}>
                Get Started Free <ArrowRight size={18} />
              </button>
            </form>
            <Checks items={['Easy setup', 'Actionable insights', 'Built for long-term growth']} />
            <div style={{ marginTop: 18 }}>
              <LearnMore href="/how-it-works">See How It Works</LearnMore>
            </div>
          </div>
          <div className={s.mock} aria-label="Product illustration with sample data">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>Website overview</b>
              <span className={s.sample}>Sample data</span>
            </div>
            <div className={s.grid3} style={{ marginTop: 14, gap: 10 }}>
              {[
                ['Site health', '82', '+9 this month'],
                ['Keywords in top 10', '64', '↑ 12 vs last period'],
                ['AI search mentions', '12', '↑ 5 vs last period'],
              ].map(([l, v, d]) => (
                <div key={l} className={s.card} style={{ padding: 14 }}>
                  <small style={{ color: 'var(--mute)' }}>{l}</small>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{v}</div>
                  <small style={{ color: 'var(--g700)' }}>{d}</small>
                </div>
              ))}
            </div>
            <b style={{ display: 'block', marginTop: 16 }}>Top opportunities</b>
            {[
              ['High', 'Fix 14 broken internal links', '8 pages'],
              ['High', 'Add missing meta descriptions', '22 pages'],
              ['Med', 'Compress oversized images', '31 files'],
            ].map(([sev, t, n]) => (
              <div key={t} className={s.mockRow}>
                <span>
                  <span className={s.sample} style={{ background: sev === 'High' ? '#fdecec' : '#fff5e0', color: sev === 'High' ? '#b42318' : '#b45309', marginRight: 8 }}>
                    {sev}
                  </span>
                  {t}
                </span>
                <small style={{ color: 'var(--mute)' }}>{n}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <div className={s.sectionHead}>
            <div>
              <div className={s.eyebrow}>How It Works</div>
              <h2 className={s.h2}>A Structured Process, Not a Checklist You Forget About</h2>
            </div>
            <LearnMore href="/how-it-works">See the Full Process</LearnMore>
          </div>
          <div className={s.steps}>
            {STEPS.map((st, i) => (
              <div key={st.title} className={`${s.card} ${s.step}`}>
                <span className={s.num}>{i < 4 ? i + 1 : <RefreshCw size={16} />}</span>
                <span className={s.icon}>{st.icon}</span>
                <h3 className={s.cardTitle}>{st.title}</h3>
                <p className={s.cardText}>{st.text}</p>
                {i < STEPS.length - 1 && <ArrowRight size={22} className={s.stepArrow} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.sectionAlt}>
        <div className={s.container}>
          <div className={s.center}>
            <div className={s.eyebrow}>Built for Results</div>
            <h2 className={s.h2}>Everything You Need to Improve SEO Performance</h2>
            <p className={s.lead}>Find what&apos;s holding you back, fix it in the right order, and prove it made a difference.</p>
          </div>
          <div className={s.grid2} style={{ marginTop: 36 }}>
            <div className={s.card}>
              <span className={s.icon}>
                <Search size={24} />
              </span>
              <h3 className={s.cardTitle}>Website Audit</h3>
              <p className={s.cardText}>Identify technical issues, content gaps, and growth opportunities — grouped so you see patterns, not noise.</p>
              <LearnMore href="/features#audit" />
            </div>
            <div className={s.card}>
              <span className={s.icon}>
                <Settings2 size={24} />
              </span>
              <h3 className={s.cardTitle}>Optimization Center</h3>
              <p className={s.cardText}>Clear, prioritized recommendations with the why behind each one.</p>
              <LearnMore href="/features#optimization" />
            </div>
            <div className={s.card} style={{ background: 'var(--g900)', color: '#fff', borderColor: 'var(--g900)' }}>
              <span className={s.icon} style={{ background: '#fff' }}>
                <Sparkles size={24} />
              </span>
              <h3 className={s.cardTitle} style={{ color: '#fff' }}>
                AI Search (GEO) <span className={s.badge}>New</span>
              </h3>
              <p className={s.cardText} style={{ color: '#d9efe0' }}>
                Search is no longer just ten blue links. Optimize your content to be understood and cited by AI search and emerging answer engines.
              </p>
              <Link href="/features#geo" className={s.learn} style={{ color: '#fff' }}>
                Learn More <ArrowRight size={16} />
              </Link>
            </div>
            <div className={s.card}>
              <span className={s.icon}>
                <BarChart3 size={24} />
              </span>
              <h3 className={s.cardTitle}>Reports</h3>
              <p className={s.cardText}>Track rankings, traffic and visibility over time — and verify what&apos;s working.</p>
              <LearnMore href="/features#reports" />
            </div>
          </div>
          <div className={s.grid4} style={{ marginTop: 20 }}>
            {[
              ['On-Page SEO Editor', 'Optimize your content with real-time guidance.', <PenSquare key="e" size={22} />],
              ['Keyword Research', 'Discover high-value keywords to target.', <Target key="k" size={22} />],
              ['Content Strategy', 'Plan and create SEO-optimized content.', <FileText key="c" size={22} />],
              ['Your Data, Your Control', 'Designed with security and privacy in mind.', <Lock key="d" size={22} />],
            ].map(([t, x, i]) => (
              <div key={t as string} className={s.card}>
                <span className={s.icon}>{i}</span>
                <h3 className={s.cardTitle}>{t}</h3>
                <p className={s.cardText}>{x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={`${s.container} ${s.split}`}>
          <div>
            <div className={s.eyebrow}>Why Engineering-Led</div>
            <h2 className={s.h2}>SEO That Behaves Like Good Software</h2>
            <p className={s.lead}>Measured inputs, prioritized work and tested outcomes. The same discipline you&apos;d expect from your engineering team.</p>
          </div>
          <div className={s.compare} style={{ marginTop: 0 }}>
            <table style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Typical SEO</th>
                  <th style={{ background: 'var(--g900)', color: '#fff' }}>With AmpliVerify</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['A long list of issues, all marked urgent', 'Fixes ranked by expected impact'],
                  ['One-off audits that go stale', 'Continuous monitoring on a schedule'],
                  ['“We think it helped”', 'Results tracked and verified over time'],
                  ['Ignores AI search', 'Optimized for search engines and AI answers'],
                  ['Reports full of jargon', 'Clear summaries anyone can act on'],
                ].map(([a, b]) => (
                  <tr key={a}>
                    <td style={{ textAlign: 'left', color: 'var(--mute)' }}>{a}</td>
                    <td style={{ textAlign: 'left' }}>
                      <Check size={16} color="#15803d" style={{ verticalAlign: -3, marginRight: 6 }} />
                      {b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CtaBand eyebrow="Start Today" title="Ready to Turn Your Website Into a Growth Engine?" text="Join AmpliVerify and get the insights you need to improve your SEO and drive sustainable growth." />
    </>
  );
}
