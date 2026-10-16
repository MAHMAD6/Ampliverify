import Link from 'next/link';
import { ArrowRight, BarChart3, ChevronRight, FileText, KeyRound, PenSquare, Play, Search, Settings2, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { CheckList, Checks, CtaBand, LearnMore } from '@/components/public/Blocks';
import { FeatureStrip, LaptopMock, ValueTeaser } from '@/components/public/Showcase';
import { apiGet } from '@/lib/api';
import type { ValuationConfig } from '@/lib/valuation';
import s from '@/components/public/site.module.css';

export const metadata = { title: 'Features', description: 'Audit, optimize, and verify your website’s SEO with clear insights, prioritized recommendations, and tools built to improve search performance.' };

const ALL = [
  { id: 'audit', icon: <Search size={24} />, title: 'Website Audit', text: 'Identify technical issues, content gaps, and growth opportunities.', q: 'audit' },
  { id: 'optimization', icon: <Settings2 size={24} />, title: 'Optimization Center', text: 'Get clear, prioritized recommendations to improve your SEO.', q: 'optimization' },
  { id: 'editor', icon: <FileText size={24} />, title: 'On-Page SEO Editor', text: 'Optimize your content with real-time guidance.', q: 'editor' },
  { id: 'keywords', icon: <Target size={24} />, title: 'Keyword Research', text: 'Discover high-value keywords to target.', q: 'keyword' },
  { id: 'content', icon: <BarChart3 size={24} />, title: 'Content Strategy', text: 'Plan and create SEO-optimized content.', q: 'content strategy' },
  { id: 'geo', icon: <Sparkles size={24} />, title: 'AI Search (GEO)', text: 'Optimize for AI search and emerging search engines.', q: 'GEO' },
  { id: 'reports', icon: <BarChart3 size={24} />, title: 'Reports', text: 'Track your progress and measure results over time.', q: 'reports' },
  { id: 'privacy', icon: <ShieldCheck size={24} />, title: 'Your Data, Your Control', text: 'Designed with security and privacy in mind.', q: 'privacy' },
];

const RECS = [
  ['#dc2626', 'Update meta descriptions'],
  ['#f59e0b', 'Optimize images'],
  ['#f59e0b', 'Fix broken links'],
  ['#3b82f6', 'Add internal links'],
  ['#3b82f6', 'Improve heading structure'],
];

/** Features (Public_Frontend/Features-Final). */
export default async function FeaturesPage() {
  const cfg = await apiGet<ValuationConfig>('/public/valuations/config', { revalidate: 60 });
  const available = cfg.ok && cfg.data.available;
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.heroGrid}`}>
          <div>
            <h1 className={s.h1}>
              SEO Engineering for <span className={s.green}>Real Results</span>
            </h1>
            <p className={s.lead}>Audit, optimize, and verify your website’s SEO with clear insights, prioritized recommendations, and tools built to improve search performance.</p>
            <div className={s.heroActions}>
              <Link href="/signup" className={s.btn}>
                Get Started Free <ArrowRight size={18} />
              </Link>
              <Link href="/how-it-works" className={s.btnOutline}>
                <span className={s.playBtn}>
                  <Play size={14} fill="currentColor" />
                </span>
                See It in Action
              </Link>
            </div>
            <Checks items={['Clear, guided workflows', 'Prioritized recommendations', 'Built to track SEO progress']} />
          </div>
          <LaptopMock />
        </div>
      </section>

      <FeatureStrip
        items={[
          { icon: <Search size={20} />, title: 'Website Audit', text: 'Identify issues and opportunities' },
          { icon: <Settings2 size={20} />, title: 'Optimization Center', text: 'Get clear, prioritized recommendations' },
          { icon: <PenSquare size={20} />, title: 'On-Page SEO Editor', text: 'Optimize your content with guidance' },
          { icon: <KeyRound size={20} />, title: 'Keyword Research', text: 'Find high-value keywords' },
          { icon: <BarChart3 size={20} />, title: 'Content Strategy', text: 'Plan and create SEO content' },
          { icon: <Sparkles size={20} />, title: 'AI Search (GEO)', text: 'Optimize for AI search' },
          { icon: <BarChart3 size={20} />, title: 'Reports', text: 'Track progress over time' },
        ]}
      />

      <section className={s.section}>
        <div className={`${s.container} ${s.split}`}>
          <div className={s.mock} aria-label="Optimization Center illustration with sample data" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>Optimization Center</b>
                <span className={s.sample}>Sample</span>
              </div>
              <div className={s.chips} style={{ margin: '10px 0', gap: 4 }}>
                {['All', 'Content', 'Technical', 'Links', 'Experience'].map((t, i) => (
                  <span key={t} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line2)', background: i === 0 ? 'var(--g900)' : '#fff', color: i === 0 ? '#fff' : 'var(--navy)' }}>
                    {t}
                  </span>
                ))}
              </div>
              {RECS.map(([c, t]) => (
                <div key={t} className={s.mockRow} style={{ marginTop: 6, padding: '9px 10px' }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <i style={{ width: 16, height: 16, borderRadius: '50%', background: c, display: 'inline-block' }} />
                    {t}
                  </span>
                  <ChevronRight size={14} color="#5d6b7c" />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <div className={s.card} style={{ padding: 12 }}>
                <b style={{ fontSize: 12 }}>Page Preview</b>
                <small style={{ display: 'block', color: 'var(--mute)', fontSize: 11, margin: '6px 0' }}>yourwebsite.com/page</small>
                {[70, 90, 60].map((w) => (
                  <div key={w} style={{ height: 6, borderRadius: 4, background: w === 70 ? 'var(--g500)' : '#e3e9e5', width: `${w}%`, margin: '6px 0' }} />
                ))}
                <span className={`${s.btn} ${s.sm}`} style={{ height: 30, fontSize: 12, marginTop: 6 }}>
                  Apply Changes
                </span>
              </div>
              <div className={s.card} style={{ padding: 12 }}>
                <b style={{ fontSize: 12 }}>Recommendation Details</b>
                {[80, 60].map((w) => (
                  <div key={w} style={{ height: 6, borderRadius: 4, background: '#e3e9e5', width: `${w}%`, margin: '8px 0' }} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className={s.eyebrow}>Optimization Center</div>
            <h2 className={s.h2}>Get Clear, Actionable Recommendations</h2>
            <p className={s.lead} style={{ fontSize: 17 }}>
              See what to improve, why it matters, and how to do it. Our tools analyze your website and help prioritize recommended changes so you can improve your search visibility.
            </p>
            <CheckList items={['Prioritized recommendations', 'Clear explanations', 'Step-by-step guidance', 'Work at your own pace']} />
            <Link href="/signup" className={s.btn} style={{ marginTop: 22 }}>
              Learn More <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className={s.sectionAlt}>
        <div className={s.container}>
          <div className={s.center}>
            <div className={s.eyebrow}>All Features</div>
            <h2 className={s.h2}>SEO Engineering Tools for Better Search Performance</h2>
            <p className={s.lead}>Explore each feature to see how AmpliVerify can help you audit, optimize, and verify your website’s SEO.</p>
          </div>
          <div className={s.grid4} style={{ marginTop: 32 }}>
            {ALL.map((f) => (
              <div key={f.id} id={f.id} className={s.card} style={{ scrollMarginTop: 100 }}>
                <span className={s.icon}>{f.icon}</span>
                <h3 className={s.cardTitle}>{f.title}</h3>
                <p className={s.cardText}>{f.text}</p>
                <LearnMore href={`/help?q=${encodeURIComponent(f.q)}`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <ValueTeaser available={available} reason={available ? undefined : 'The calculator is not available yet. Please check back soon.'} consentVersion={cfg.ok ? cfg.data.consentVersion : undefined} />

      <CtaBand eyebrow="See the Difference" title="Ready to Engineer SEO Growth?" text="Join AmpliVerify and get the tools and insights you need to improve your search visibility and drive sustainable growth." />
    </>
  );
}
