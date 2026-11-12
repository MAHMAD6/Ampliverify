import Link from 'next/link';
import { ArrowRight, BarChart3, FileText, Layers, Link2, ScanSearch, Play, Search, Settings2, ShieldCheck, Store, Target } from 'lucide-react';
import { CtaBand, Checks, LearnMore } from '@/components/public/Blocks';
import { FeatureStrip, LaptopMock, ValueTeaser } from '@/components/public/Showcase';
import { apiGet } from '@/lib/api';
import type { ValuationConfig } from '@/lib/valuation';
import s from '@/components/public/site.module.css';

export const metadata = { title: { absolute: 'AmpliVerify — Turn Your Website Into a Growth Engine' } };

const STEPS = [
  { title: 'Discover & Analyze', text: 'Examine websites and identify opportunities.', icon: <Search size={30} /> },
  { title: 'Evaluate', text: 'Review SEO, traffic, valuation, and key business data.', icon: <FileText size={30} /> },
  { title: 'Plan & Optimize', text: 'Implement technical, content, and visibility improvements.', icon: <Settings2 size={30} /> },
  { title: 'Monitor Performance', text: 'Track rankings, traffic, and changes in estimated value.', icon: <BarChart3 size={30} /> },
  { title: 'Grow or Sell', text: 'Continue building value or list your asset on the Marketplace.', icon: <Link2 size={30} /> },
];

/** The three product areas (Homepage V2). */
const PILLARS = [
  { icon: <ScanSearch size={30} />, title: 'SEO Engineering', tag: 'Audit. Optimize. Verify.', text: 'Analyze your website, identify improvement opportunities, and strengthen search visibility.', cta: 'Explore SEO Tools', href: '/features' },
  { icon: <Layers size={30} />, title: 'Asset Tools', tag: 'Evaluate. Improve. Grow.', text: 'Access tools and insights to evaluate, optimize, and increase the value of your digital assets.', cta: 'Explore Asset Tools', href: '/asset-tools' },
  { icon: <Store size={30} />, title: 'Marketplace', tag: 'Discover. Buy. Sell.', text: 'Explore websites, domains, SaaS businesses, e-commerce stores, and other digital assets available for sale.', cta: 'Explore Marketplace', href: '/marketplace' },
];

const CARDS = [
  { icon: <Search size={24} />, title: 'Acquisition Analysis', text: 'Evaluate potential acquisitions, asking prices, risks, and available data.', href: '/asset-tools/acquisition-analysis' },
  { icon: <Settings2 size={24} />, title: 'Asset Optimization', text: 'Identify and implement SEO and content improvements to increase value and visibility.', href: '/asset-tools/asset-optimization' },
  { icon: <Layers size={24} />, title: 'Asset Intelligence', text: 'Organize your assets, track improvement plans, and manage projects efficiently.', href: '/asset-tools/asset-overview' },
  { icon: <BarChart3 size={24} />, title: 'Valuation & Performance', text: 'Monitor traffic, rankings, and estimated value changes over time.', href: '/asset-tools/valuation-performance' },
];

/** Home (Frontend_V2/Homepage_V2). Product imagery is labelled as sample data. */
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
            <p className={s.lead}>AmpliVerify helps you audit, optimize, and grow your website with intelligent SEO tools. Discover opportunities, track improvements, and connect with buyers and sellers through the AmpliVerify Marketplace.</p>
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

      <section className={s.section} style={{ paddingBottom: 0 }}>
        <div className={`${s.container} ${s.grid3}`}>
          {PILLARS.map((p) => (
            <Link key={p.title} href={p.href} className={s.pillar}>
              <span className={s.icon} aria-hidden>
                {p.icon}
              </span>
              <h2 className={s.pillarTitle}>{p.title}</h2>
              <b className={s.pillarTag}>{p.tag}</b>
              <p className={s.cardText}>{p.text}</p>
              <span className={s.learn}>
                {p.cta} <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <div className={s.center}>
            <div className={s.eyebrowSpaced}>SEO Engineering</div>
            <h2 className={s.h2}>How It Works</h2>
            <p className={s.lead}>A simple, end-to-end process to analyze, improve, and grow your website or digital asset.</p>
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
            <h2 className={s.h2}>Make Smarter Digital Asset Decisions</h2>
            <p className={s.lead}>Evaluate opportunities, improve performance, and unlock the full value of your digital assets.</p>
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

      <section className={s.section} style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className={s.container}>
          <div className={s.marketBand}>
            <span className={s.marketBandIcon} aria-hidden>
              <Store size={40} />
            </span>
            <div className={s.grow}>
              <h2 className={s.marketBandTitle}>Explore the Marketplace</h2>
              <p className={s.cardText} style={{ margin: 0 }}>
                Discover websites, domains, SaaS businesses, e-commerce stores, and other digital assets.
              </p>
            </div>
            <Link href="/marketplace/listings" className={s.btn}>
              Browse Assets <ArrowRight size={18} />
            </Link>
            <Link href="/sell" className={s.btnOutline}>
              Sell a Digital Asset <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <CtaBand title="Ready to Turn Your Website Into a Growth Engine?" text="Join AmpliVerify and get the insights you need to improve your SEO, grow your digital assets, and explore new opportunities." />
    </>
  );
}
