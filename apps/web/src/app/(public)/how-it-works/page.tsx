import Link from 'next/link';
import { ArrowRight, Globe, Link2, RefreshCw, Users } from 'lucide-react';
import { CheckList, CtaBand, PageHero } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata = { title: 'How It Works' };

const STEPS = [
  {
    tags: ['About 5 minutes'],
    title: 'Connect Your Website',
    text: 'Add your domain and connect the data sources you already use. You choose what AmpliVerify can access, and you stay in control of every change.',
    items: ['Verify ownership in one step', 'Optional search & analytics connections'],
    mock: [['example.com', 'Verified'], ['Search performance data', 'Connected'], ['Analytics', 'Connect']],
  },
  {
    tags: ['Website Audit'],
    title: 'Audit & Analyze',
    text: 'Website Audit crawls every page and analyzes technical health, content and search performance, then groups issues by root cause.',
    items: ['Technical, content and performance checks', 'Baseline saved for later comparison'],
    mock: [['Technical', '74'], ['Content', '61'], ['Performance', '28']],
  },
  {
    tags: ['Optimization Center', 'On-Page SEO Editor', 'Keyword Research', 'Content Strategy', 'AI Search (GEO)'],
    title: 'Optimize',
    text: 'Work through prioritized recommendations in the Optimization Center, improve pages with the On-Page SEO Editor, and plan new content around the right keywords — for search engines and AI search.',
    items: ['Highest impact, lowest effort first', 'Guidance your writers and developers can follow'],
    mock: [['01 Consolidate redirect chains', '▲▲▲'], ['02 Rewrite duplicate titles', '▲▲'], ['03 Defer non-critical scripts', '▲▲'], ['04 Add alt text to product images', '▲']],
  },
  {
    tags: ['Reports'],
    title: 'Monitor & Verify',
    text: 'Reports track rankings, traffic and search visibility over time, so you can verify which improvements are working and where to focus next.',
    items: ['Rankings, traffic and visibility trends', 'See the impact of the changes you make'],
    mock: [['Clicks to /blog: baseline → +28 days', '+62%']],
  },
];

/** How It Works (public-website-v2/03). Step illustrations use labelled sample data. */
export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        center
        eyebrow="How It Works"
        title={
          <>
            From First Crawl to <span className={s.green}>Verified Growth</span> in Five Steps
          </>
        }
        lead="A structured, engineering-led process. You always know what to do next, why it matters, and whether it worked."
      >
        <div className={s.heroActions}>
          <Link href="/signup" className={s.btn}>
            Get Started Free <ArrowRight size={18} />
          </Link>
        </div>
      </PageHero>
      <section className={s.section}>
        <div className={s.container} style={{ display: 'grid', gap: 20 }}>
          {STEPS.map((st, i) => (
            <div key={st.title} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 18 }}>
              <span className={s.icon} style={{ background: 'var(--g900)', color: '#fff', fontWeight: 800, fontSize: 18 }}>
                {i + 1}
              </span>
              <div className={`${s.card} ${s.split}`} style={{ gap: 32 }}>
                <div>
                  <div className={s.pills}>
                    {st.tags.map((t) => (
                      <span key={t} className={s.badge}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2 className={s.h2} style={{ fontSize: 30 }}>
                    {st.title}
                  </h2>
                  <p className={s.cardText}>{st.text}</p>
                  <CheckList items={st.items} />
                </div>
                <div className={s.mock} style={{ background: 'var(--g25)', boxShadow: 'none' }}>
                  <span className={s.sample}>Sample data</span>
                  {st.mock.map(([a, b]) => (
                    <div key={a} className={s.mockRow} style={{ background: '#fff' }}>
                      {a} <b style={{ color: 'var(--g700)' }}>{b}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 18 }}>
            <span className={s.icon} style={{ background: 'var(--g900)', color: '#fff' }}>
              <RefreshCw size={22} />
            </span>
            <div className={s.ctaDark} style={{ gridTemplateColumns: '1fr' }}>
              <div>
                <span className={s.badge}>All tools, on repeat</span>
                <h2 className={s.h2}>Improve Continuously</h2>
                <p style={{ color: '#d9efe0', lineHeight: 1.6, maxWidth: 620 }}>Refine your strategy and scale what works. Regular audits catch new issues, and verified results show you where to invest next — so growth compounds.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className={s.sectionAlt}>
        <div className={s.container}>
          <div className={s.eyebrow}>Getting Started</div>
          <h2 className={s.h2}>What You Need on Day One</h2>
          <div className={s.grid3} style={{ marginTop: 24 }}>
            {[
              ['Your Website Address', "That's enough to run your first audit.", <Globe key="g" size={22} />],
              ['Optional Data Access', 'Connect search and analytics for richer results.', <Link2 key="l" size={22} />],
              ['Someone to Ship Fixes', 'You, a developer or a writer — each task says who.', <Users key="u" size={22} />],
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
      <CtaBand eyebrow="Get Started" title="Start with Step One Today" text="Connect your website and get your first prioritized plan free." secondary={{ label: 'Explore Features', href: '/features' }} />
    </>
  );
}
