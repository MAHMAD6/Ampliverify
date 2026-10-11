import { ArrowRight, BarChart3, BookOpen, CheckCircle2, Globe, Link2, RefreshCw, Search, Settings2, Users } from 'lucide-react';
import { CheckList, CtaBand } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata = { title: 'How It Works', description: 'A structured, engineering-led process to improve your search visibility and drive measurable growth.' };

const STEPS = [
  { title: 'Connect Your Website', text: 'Add your website and connect available data sources.', icon: <Link2 size={30} /> },
  { title: 'Audit & Analyze', text: 'Analyze your website, technical health, content, and search performance.', icon: <Search size={30} /> },
  { title: 'Optimize', text: 'Get prioritized recommendations and implement improvements.', icon: <Settings2 size={30} /> },
  { title: 'Monitor & Verify', text: 'Track performance and search visibility to verify results.', icon: <BarChart3 size={30} /> },
  { title: 'Improve Continuously', text: 'Refine your strategy and scale what works for lasting growth.', icon: <RefreshCw size={30} /> },
];

const PRIORITY = { High: ['#fdecec', '#b42318'], Medium: ['#fff5e0', '#b45309'], Low: ['#e8f0fe', '#1d4ed8'] } as const;

function Num({ n }: { n: number }) {
  return (
    <span className={s.num} style={{ position: 'static', display: 'inline-grid' }}>
      {n}
    </span>
  );
}

/** How It Works (Public_Frontend/How-It_Works). Step illustrations use labelled sample data. */
export default function HowItWorksPage() {
  const traffic = [1.1, 1.6, 1.9, 1.5, 1.7, 2.2, 2.1, 2.7, 3.5, 3.6, 3.1, 3.9, 4.0, 4.5];
  const max = 6;
  const pts = traffic.map((v, i) => `${(i * 300) / (traffic.length - 1)},${(130 - (v / max) * 120).toFixed(1)}`).join(' ');
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.center}`}>
          <div className={s.eyebrow}>How It Works</div>
          <h1 className={s.h1}>
            From First Crawl to <span className={s.green}>Measured Growth</span> in Five Steps
          </h1>
          <p className={s.lead}>A structured, engineering-led process to improve your search visibility and drive measurable growth.</p>
          <div className={s.steps} style={{ marginTop: 40, textAlign: 'left' }}>
            {STEPS.map((st, i) => (
              <div key={st.title} className={`${s.card} ${s.step}`} style={{ textAlign: 'center' }}>
                <span className={s.num}>{i + 1}</span>
                <span className={s.icon}>{st.icon}</span>
                <h3 className={s.cardTitle} style={{ fontSize: 17 }}>
                  {st.title}
                </h3>
                <p className={s.cardText} style={{ fontSize: 14 }}>
                  {st.text}
                </p>
                {i < STEPS.length - 1 && <ArrowRight size={22} className={s.stepArrow} />}
              </div>
            ))}
          </div>
          <div className={s.loop}>
            <span className={s.icon}>
              <RefreshCw size={22} />
            </span>
            <div style={{ textAlign: 'left' }}>
              <b style={{ color: 'var(--g900)' }}>Continuous Improvement</b>
              <small>Ongoing analysis, optimization, and scaling to maximize long-term growth.</small>
            </div>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container} style={{ display: 'grid', gap: 22 }}>
          <div className={s.grid3}>
            <div className={s.card}>
              <Num n={1} />
              <h2 className={s.cardTitle} style={{ fontSize: 22 }}>
                Connect Your Website
              </h2>
              <p className={s.cardText}>Add your domain and connect the data sources you already use. You choose what AmpliVerify can access, and you stay in control of every change.</p>
              <CheckList items={['Verify ownership in one step', 'Connect Google Search Console', 'Optional analytics & additional sources', 'Secure and read-only access']} />
              <div className={s.mock} style={{ marginTop: 18 }} aria-label="Sample setup">
                <b style={{ fontSize: 13 }}>Add Your Website</b>
                <div className={s.mockRow}>
                  <span>
                    <Globe size={14} /> example.com
                  </span>
                  <span className={s.badge}>
                    <CheckCircle2 size={12} /> Verified
                  </span>
                </div>
                <b style={{ fontSize: 13, display: 'block', marginTop: 12 }}>Connect Data Sources (Optional)</b>
                <div className={s.mockRow}>
                  <span>Google Search Console</span>
                  <span className={s.badge}>Connected</span>
                </div>
                <div className={s.mockRow}>
                  <span>Google Analytics</span>
                  <span className={s.sample}>Connect</span>
                </div>
              </div>
            </div>
            <div className={s.card}>
              <Num n={2} />
              <h2 className={s.cardTitle} style={{ fontSize: 22 }}>
                Audit &amp; Analyze
              </h2>
              <p className={s.cardText}>AmpliVerify crawls every page and analyzes technical health, content and search performance, then groups issues by root cause.</p>
              <CheckList items={['Technical, content and performance checks', 'Clear issue prioritization', 'Baseline saved for later comparison', 'Actionable insights you can trust']} />
              <div className={s.mock} style={{ marginTop: 18 }} aria-label="Sample audit">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <b>Crawling your site…</b>
                  <span>1,284 / 1,284</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--g700)', margin: '8px 0 12px' }} />
                <div className={s.grid4} style={{ gap: 8 }}>
                  {[
                    ['Technical', '74', '#dc2626'],
                    ['Content', '61', '#f59e0b'],
                    ['Performance', '28', '#3b82f6'],
                    ['Good', '842', '#15803d'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ borderLeft: `3px solid ${c}`, paddingLeft: 8 }}>
                      <small style={{ fontSize: 11, color: 'var(--mute)' }}>{l}</small>
                      <b style={{ display: 'block', fontSize: 20 }}>{v}</b>
                    </div>
                  ))}
                </div>
                {[
                  ['18 critical issues', '#dc2626'],
                  ['42 recommended fixes', '#f59e0b'],
                  ['28 opportunities', '#3b82f6'],
                ].map(([t, c]) => (
                  <div key={t} className={s.mockRow} style={{ padding: '8px 10px' }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <i style={{ width: 14, height: 14, borderRadius: '50%', background: c, display: 'inline-block' }} /> {t}
                    </span>
                    <span style={{ color: '#2563eb', fontSize: 12 }}>View →</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={s.card}>
              <Num n={3} />
              <h2 className={s.cardTitle} style={{ fontSize: 22 }}>
                Optimize
              </h2>
              <p className={s.cardText}>Work through prioritized recommendations in the Optimization Center, improve pages with the On-Page SEO Editor, and plan new content around the right keywords — for search engines and AI search.</p>
              <CheckList items={['Highest impact, lowest effort first', 'Guidance your writers and developers can follow', 'Templates and AI-assisted suggestions', 'Organize by priority and track progress']} />
              <div className={s.mock} style={{ marginTop: 18 }} aria-label="Sample recommendations">
                <b style={{ fontSize: 13 }}>Top Prioritized Recommendations</b>
                {(
                  [
                    ['01', 'Consolidate redirect chains', 'High'],
                    ['02', 'Rewrite duplicate titles', 'Medium'],
                    ['03', 'Improve meta descriptions', 'Medium'],
                    ['04', 'Add alt text to product images', 'Low'],
                  ] as const
                ).map(([n, t, p]) => (
                  <div key={n} className={s.mockRow} style={{ padding: '8px 10px' }}>
                    <span style={{ color: '#1d4ed8' }}>
                      {n} {t}
                    </span>
                    <span className={s.sample} style={{ background: PRIORITY[p][0], color: PRIORITY[p][1] }}>
                      {p}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={s.grid2}>
            <div className={s.card}>
              <Num n={4} />
              <h2 className={s.cardTitle} style={{ fontSize: 22 }}>
                Monitor &amp; Verify
              </h2>
              <p className={s.cardText}>Track rankings, traffic and search visibility over time, so you can verify which improvements are working and where to focus next.</p>
              <CheckList items={['Rankings, traffic and visibility trends', 'Compare before and after changes', 'Easy-to-share reports']} />
              <div className={s.mock} style={{ marginTop: 18 }} aria-label="Sample traffic chart">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 13 }}>
                    Organic Traffic <small style={{ color: 'var(--mute)', fontWeight: 500 }}>(Sample Data)</small>
                  </b>
                  <span className={s.badge}>+62% vs. previous 28 days</span>
                </div>
                <svg viewBox="0 0 300 140" style={{ width: '100%', height: 'auto', marginTop: 10 }} aria-hidden>
                  {[0, 40, 80, 120].map((y) => (
                    <line key={y} x1="0" x2="300" y1={10 + y} y2={10 + y} stroke="#e3e9e5" />
                  ))}
                  <polyline points={pts} fill="none" stroke="#15803d" strokeWidth="2.5" />
                </svg>
                <p style={{ fontSize: 12, color: 'var(--mute)', textAlign: 'center' }}>Sample data for illustration only. Results will vary.</p>
              </div>
            </div>
            <div className={s.card}>
              <Num n={5} />
              <h2 className={s.cardTitle} style={{ fontSize: 22 }}>
                Improve Continuously
              </h2>
              <p className={s.cardText}>Refine your strategy and scale what works. Regular audits catch new issues, and verified results show you where to invest next — so growth compounds.</p>
              <CheckList items={['Automated re-audits', 'Track progress over time', 'New opportunities as your site grows', 'Build a sustainable SEO strategy']} />
              <div className={s.cycle} aria-label="Growth cycle: audit, optimize, verify, learn">
                <span className={s.cycleCore}>
                  Growth
                  <small>Compounding</small>
                </span>
                {[
                  ['Audit', <BarChart3 key="a" size={20} />, s.cTop],
                  ['Optimize', <Settings2 key="o" size={20} />, s.cRight],
                  ['Verify', <CheckCircle2 key="v" size={20} />, s.cBottom],
                  ['Learn', <BookOpen key="l" size={20} />, s.cLeft],
                ].map(([l, icon, pos]) => (
                  <span key={String(l)} className={`${s.cycleNode} ${pos}`}>
                    <span className={s.icon} style={{ width: 44, height: 44 }}>
                      {icon}
                    </span>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={s.sectionAlt}>
        <div className={s.container}>
          <div className={s.center}>
            <div className={s.eyebrow}>Getting Started</div>
            <h2 className={s.h2}>What You Need on Day One</h2>
            <p className={s.lead}>You can start with just your website. Everything else is optional.</p>
          </div>
          <div className={s.grid3} style={{ marginTop: 30 }}>
            {[
              [<Globe key="g" size={22} />, 'Your Website Address', 'That’s enough to run your first audit.'],
              [<Link2 key="l" size={22} />, 'Optional Data Access', 'Connect search and analytics for richer results.'],
              [<Users key="u" size={22} />, 'Someone to Ship Fixes', 'You, a developer or a writer — each task says who.'],
            ].map(([icon, t, x]) => (
              <div key={String(t)} className={s.card}>
                <span className={s.icon}>{icon}</span>
                <h3 className={s.cardTitle}>{t}</h3>
                <p className={s.cardText}>{x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand eyebrow="Get Started" title="Start with Step One Today" text="Connect your website and get your first prioritized plan free." secondary={{ label: 'Explore Features', href: '/features' }} />
    </>
  );
}
