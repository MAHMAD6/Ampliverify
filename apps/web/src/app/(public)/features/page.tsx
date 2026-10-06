import Link from 'next/link';
import { ArrowRight, BarChart3, FileText, Lock, PenSquare, Search, Settings2, Sparkles, Target } from 'lucide-react';
import { CheckList, Checks, CtaBand, LearnMore } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata = { title: 'Features' };

const ALL = [
  ['Website Audit', 'Identify technical issues, content gaps, and growth opportunities.', '#audit', <Search key="a" size={24} />],
  ['Optimization Center', 'Get clear, prioritized recommendations to improve your SEO.', '#optimization', <Settings2 key="o" size={24} />],
  ['On-Page SEO Editor', 'Optimize your content with real-time guidance.', '#editor', <PenSquare key="e" size={24} />],
  ['Keyword Research', 'Discover high-value keywords to target.', '#more', <Target key="k" size={24} />],
  ['Content Strategy', 'Plan and create SEO-optimized content.', '#more', <FileText key="c" size={24} />],
  ['AI Search (GEO)', 'Optimize for AI search and emerging search engines.', '#geo', <Sparkles key="g" size={24} />],
  ['Reports', 'Track your progress and measure results over time.', '#more', <BarChart3 key="r" size={24} />],
  ['Your Data, Your Control', 'Designed with security and privacy in mind.', '#more', <Lock key="d" size={24} />],
] as const;

/** Features (public-website-v2/02-Features). Illustrations are labelled "Sample data"; the customer quote is omitted until a real one is approved. */
export default function FeaturesPage() {
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.heroGrid}`}>
          <div>
            <div className={s.eyebrow}>Features</div>
            <h1 className={s.h1}>
              SEO Engineering <span className={s.green}>for Real Results</span>
            </h1>
            <p className={s.lead}>
              Audit, optimize, <b>and verify</b> your website&apos;s SEO with powerful, easy-to-use tools — all in one place.
            </p>
            <div className={s.heroActions}>
              <Link href="/signup" className={s.btn}>
                Get Started Free <ArrowRight size={18} />
              </Link>
              <Link href="/how-it-works" className={s.btnOutline}>
                See It in Action
              </Link>
            </div>
            <Checks items={['Easy to use', 'Actionable insights', 'Built for measurable SEO progress']} />
          </div>
          <div className={s.mock} aria-label="Product illustration">
            <div className={s.mockRow} style={{ marginTop: 0 }}>
              <span style={{ color: 'var(--mute)' }}>https://yourwebsite.com</span>
              <Search size={16} />
            </div>
            <b style={{ display: 'block', margin: '16px 0 4px' }}>SEO Audit</b>
            {['Technical Issues', 'Content Opportunities', 'On-Page Optimization', 'Link Improvements'].map((x) => (
              <div key={x} className={s.mockRow}>
                {x} <ArrowRight size={14} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className={s.strip}>
        <div className={`${s.container} ${s.stripIn}`}>
          {['Free plan, $0 per month', 'Upgrade or cancel anytime', 'Secure payments with Stripe', 'Built for search engines & AI search'].map((x) => (
            <div key={x} className={s.stripItem}>
              <b>✓ {x}</b>
            </div>
          ))}
        </div>
      </div>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.center}>
            <div className={s.eyebrow}>All Features</div>
            <h2 className={s.h2}>A Complete Set of SEO Engineering Tools</h2>
            <p className={s.lead}>Explore each feature to see how AmpliVerify helps you audit, optimize, and verify your website&apos;s SEO — for search engines and AI search.</p>
          </div>
          <div className={s.grid4} style={{ marginTop: 36 }}>
            {ALL.map(([t, x, h, i]) => (
              <div key={t} className={s.card} style={{ display: 'flex', gap: 14 }}>
                <span className={s.icon}>{i}</span>
                <div>
                  <h3 className={s.cardTitle} style={{ marginTop: 0 }}>
                    {t}
                  </h3>
                  <p className={s.cardText}>{x}</p>
                  <LearnMore href={h} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="audit" className={s.sectionAlt}>
        <div className={`${s.container} ${s.split}`}>
          <div>
            <div className={s.eyebrow}>Website Audit</div>
            <h2 className={s.h2}>Find Every Issue Holding Your Site Back</h2>
            <p className={s.lead}>A full crawl of your website that checks technical health, content and search performance — then groups findings by root cause so one fix can clear many issues.</p>
            <CheckList items={['Crawlability, indexing and redirects', 'Page speed and Core Web Vitals', 'Titles, meta, headings and structured data']} />
          </div>
          <div className={s.mock}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <b>Site Audit</b>
              <span className={s.sample}>Sample data · example.com</span>
            </div>
            {[
              ['Technical', 74],
              ['Content', 61],
              ['Performance', 28],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 30px', gap: 10, alignItems: 'center', marginTop: 12, fontSize: 14 }}>
                {l}
                <span style={{ height: 8, borderRadius: 99, background: '#eef1f4' }}>
                  <span style={{ display: 'block', height: 8, borderRadius: 99, width: `${v}%`, background: 'var(--g700)' }} />
                </span>
                <b>{v}</b>
              </div>
            ))}
            <div className={s.mockRow}>
              Redirect chains on product pages <small>38 pages</small>
            </div>
            <div className={s.mockRow}>
              Missing meta descriptions <small>22 pages</small>
            </div>
          </div>
        </div>
      </section>
      <section id="optimization" className={s.section}>
        <div className={`${s.container} ${s.split}`}>
          <div className={s.mock}>
            <b>Optimization Center</b>
            {['Update meta descriptions', 'Optimize images', 'Fix broken links', 'Add internal links', 'Improve heading structure'].map((x) => (
              <div key={x} className={s.mockRow}>
                {x} <ArrowRight size={14} />
              </div>
            ))}
          </div>
          <div>
            <div className={s.eyebrow}>Optimization Center</div>
            <h2 className={s.h2}>Get Clear, Actionable Recommendations</h2>
            <p className={s.lead}>See what to improve, why it matters, and how to do it. Our tools analyze your website and help prioritize recommended changes so you can improve your search visibility.</p>
            <CheckList items={['Prioritized recommendations', 'Clear explanations', 'Step-by-step guidance', 'Work at your own pace']} />
          </div>
        </div>
      </section>
      <section id="editor" className={s.sectionAlt}>
        <div className={`${s.container} ${s.split}`}>
          <div>
            <div className={s.eyebrow}>On-Page SEO Editor</div>
            <h2 className={s.h2}>Write and Improve Pages With Real-Time Guidance</h2>
            <p className={s.lead}>Edit titles, headings and copy while AmpliVerify checks them against your target keywords and on-page best practices — so every page is ready before it goes live.</p>
            <CheckList items={['Live on-page score as you write', 'Keyword, heading and meta suggestions', 'Internal link recommendations']} />
          </div>
          <div className={s.mock}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <b>On-Page Score</b>
              <span className={s.sample}>Sample data</span>
            </div>
            {['✓ Keyword in title', '✓ Heading structure', '! Add 2 internal links', 'i Meta description: 142 chars'].map((x) => (
              <div key={x} className={s.mockRow}>
                {x}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="geo" className={s.section}>
        <div className={s.container}>
          <div className={s.ctaDark} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div className={s.eyebrow} style={{ color: '#bde8c8' }}>
                AI Search (GEO) · New
              </div>
              <h2 className={s.h2}>Get Found in AI Answers, Not Just Search Results</h2>
              <p style={{ color: '#d9efe0', lineHeight: 1.6 }}>People now ask AI assistants and answer engines for recommendations. Generative engine optimization (GEO) helps your content be understood, trusted and cited when they do.</p>
              <ul className={s.list} style={{ color: '#fff' }}>
                {['Recommendations for AI-ready content', 'Structured data and entity guidance', "Track how often you're mentioned"].map((x) => (
                  <li key={x}>✓ {x}</li>
                ))}
              </ul>
              <Link href="/signup" className={s.btnWhite} style={{ marginTop: 22 }}>
                Get Started Free <ArrowRight size={18} />
              </Link>
            </div>
            <div className={s.mock} style={{ color: 'var(--navy)' }}>
              <div className={s.mockRow} style={{ marginTop: 0 }}>
                What&apos;s the best SEO audit tool for small teams?
              </div>
              <b style={{ display: 'block', margin: '12px 0' }}>AI answer</b>
              <div className={s.grid3} style={{ gap: 8 }}>
                {[
                  ['AI mentions', '12'],
                  ['Pages AI-ready', '34'],
                  ['Schema coverage', '71%'],
                ].map(([l, v]) => (
                  <div key={l} className={s.card} style={{ padding: 12 }}>
                    <small>{l}</small>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
                  </div>
                ))}
              </div>
              <span className={s.sample} style={{ display: 'inline-block', marginTop: 10 }}>
                Sample data
              </span>
            </div>
          </div>
        </div>
      </section>
      <section id="more" className={s.sectionAlt}>
        <div className={s.container}>
          <div className={s.center}>
            <div className={s.eyebrow}>More Tools</div>
            <h2 className={s.h2}>Everything Else You Need, in One Place</h2>
          </div>
          <div className={s.grid2} style={{ marginTop: 32 }}>
            {(
              [
                ['Keyword Research', 'Discover high-value keywords to target and see which pages should rank for them.', ['Search volume and difficulty', 'Opportunities mapped to your pages', 'Keywords grouped by topic'], <Target key="k" size={24} />],
                ['Content Strategy', 'Plan and create SEO-optimized content that fills real gaps in your site.', ['Content gap analysis', 'Topic planning', 'Guidance for new pages'], <FileText key="c" size={24} />],
                ['Reports', "Track your progress and measure results over time — and verify what's working.", ['Rankings, traffic and visibility trends', 'See the impact of changes you make', 'Shareable reports for your team'], <BarChart3 key="r" size={24} />],
                ['Your Data, Your Control', 'Designed with security and privacy in mind from day one.', ['Secure, permission-based connections', 'Export your data anytime', 'Delete your data on request'], <Lock key="d" size={24} />],
              ] as const
            ).map(([t, x, items, i]) => (
              <div key={t} className={s.card} style={{ display: 'flex', gap: 16 }}>
                <span className={s.icon}>{i}</span>
                <div>
                  <h3 className={s.cardTitle} style={{ marginTop: 0 }}>
                    {t}
                  </h3>
                  <p className={s.cardText}>{x}</p>
                  <CheckList items={[...items]} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand eyebrow="See the Difference" title="Ready to Engineer SEO Growth?" text="Join AmpliVerify and get the tools and insights you need to improve your search visibility and drive sustainable growth." />
    </>
  );
}
