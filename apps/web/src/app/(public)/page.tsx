import Link from 'next/link';
import { ArrowRight, BarChart3, FileText, Link2, Play, Search, Settings2, ShieldCheck, Target } from 'lucide-react';
import { CtaBand, Checks, LearnMore } from '@/components/public/Blocks';
import { FeatureStrip, LaptopMock, ValueTeaser } from '@/components/public/Showcase';
import { apiGet } from '@/lib/api';
import type { ValuationConfig } from '@/lib/valuation';
import s from '@/components/public/site.module.css';

export const metadata = { title: { absolute: 'AmpliVerify — Turn Your Website Into a Growth Engine' } };

const STEPS = [
  { title: 'Connect Your Website', text: 'Add your website and we’ll analyze your site data.', icon: <Link2 size={30} /> },
  { title: 'Audit & Analyze', text: 'Get a comprehensive SEO audit with clear insights.', icon: <Search size={30} /> },
  { title: 'Get Recommendations', text: 'See prioritized, actionable fixes tailored to your site.', icon: <FileText size={30} /> },
  { title: 'Optimize', text: 'Implement recommendations and improve your site.', icon: <Settings2 size={30} /> },
  { title: 'Monitor & Verify', text: 'Track performance and verify your results over time.', icon: <BarChart3 size={30} /> },
];

const CARDS = [
  { icon: <Search size={24} />, title: 'Comprehensive Audits', text: 'Identify technical issues, content gaps, and growth opportunities.', href: '/features#audit' },
  { icon: <Settings2 size={24} />, title: 'Actionable Optimization', text: 'Get clear, prioritized recommendations to improve your SEO.', href: '/features#optimization' },
  { icon: <BarChart3 size={24} />, title: 'Track Real Results', text: 'Monitor rankings, traffic, and visibility over time.', href: '/features#reports' },
  { icon: <Target size={24} />, title: 'Built for Growth', text: 'Turn insights into measurable growth for your business.', href: '/how-it-works' },
];

/** Home (Public_Frontend/Home_Page). Product imagery is labelled as sample data. */
export default async function HomePage() {
  const cfg = await apiGet<ValuationConfig>('/public/valuations/config', { revalidate: 60 });
  const available = cfg.ok && cfg.data.available;
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.heroGrid}`}>
          <div>
            <div className={s.eyebrowSpaced}>SEO Engineering</div>
            <h1 className={s.h1}>
              Turn Your Website Into a <span className={s.green}>Growth Engine</span>
            </h1>
            <p className={s.lead}>AmpliVerify helps you audit, optimize, and verify your website&apos;s SEO so you can increase search visibility, attract the right visitors, and achieve measurable growth.</p>
            <div className={s.heroActions}>
              <Link href="/signup" className={s.btn}>
                Get Started Free <ArrowRight size={18} />
              </Link>
              <Link href="/how-it-works" className={s.btnOutline}>
                <span className={s.playBtn}>
                  <Play size={14} fill="currentColor" />
                </span>
                See How It Works
              </Link>
            </div>
            <Checks items={['Free for everyone', 'No credit card required', 'Actionable insights']} />
          </div>
          <LaptopMock />
        </div>
      </section>

      <FeatureStrip
        items={[
          { icon: <Search size={22} />, title: 'Website Audit', text: 'Identify issues and opportunities' },
          { icon: <Settings2 size={22} />, title: 'Actionable Recommendations', text: 'Clear, prioritized steps' },
          { icon: <BarChart3 size={22} />, title: 'Search Visibility', text: 'Track progress over time' },
          { icon: <Target size={22} />, title: 'Growth Focused', text: 'Built for real results' },
          { icon: <ShieldCheck size={22} />, title: 'Secure & Private', text: 'Your data is protected' },
        ]}
      />

      <section className={s.section}>
        <div className={s.container}>
          <div className={s.center}>
            <div className={s.eyebrowSpaced}>SEO Engineering</div>
            <h2 className={s.h2}>How It Works</h2>
            <p className={s.lead}>A simple, proven process to audit, optimize, and improve your SEO.</p>
          </div>
          <div className={s.steps} style={{ marginTop: 36 }}>
            {STEPS.map((st, i) => (
              <div key={st.title} className={s.step}>
                <span className={s.num}>{i + 1}</span>
                <span className={s.icon}>{st.icon}</span>
                <h3 className={s.cardTitle}>{st.title}</h3>
                <p className={s.cardText}>{st.text}</p>
                {i < STEPS.length - 1 && <ArrowRight size={22} className={s.stepArrow} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <ValueTeaser available={available} reason={available ? undefined : 'The calculator is not available yet. Please check back soon.'} consentVersion={cfg.ok ? cfg.data.consentVersion : undefined} />

      <section className={s.section} style={{ paddingTop: 24 }}>
        <div className={s.container}>
          <div className={s.center}>
            <h2 className={s.h2}>Find and Fix What Matters for SEO</h2>
            <p className={s.lead}>Powerful tools and insights to help you identify opportunities, take action, and achieve measurable growth.</p>
          </div>
          <div className={s.grid4} style={{ marginTop: 32 }}>
            {CARDS.map((c) => (
              <div key={c.title} className={s.card}>
                <span className={s.icon}>{c.icon}</span>
                <h3 className={s.cardTitle}>{c.title}</h3>
                <p className={s.cardText}>{c.text}</p>
                <LearnMore href={c.href} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Ready to Turn Your Website Into a Growth Engine?" text="Join AmpliVerify and get the insights you need to improve your SEO and achieve measurable growth." />
    </>
  );
}
