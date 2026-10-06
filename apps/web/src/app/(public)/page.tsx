import { BarChart3, CheckCircle2, FilePenLine, Layers, Search, SquarePen, Target } from 'lucide-react';
import { Hero, NumberedList } from '@/components/public/Hero';
import { ButtonLink } from '@/components/ui';
import s from '@/components/public/public.module.css';

const FEATURES = [
  { icon: <SquarePen size={24} />, title: 'On-Page SEO Audit', text: 'Find page-level issues and opportunities, with every run kept so you can compare progress.' },
  { icon: <FilePenLine size={24} />, title: 'SEO Editor', text: 'Apply changes with guided, reviewable suggestions. Nothing is changed without your approval.' },
  { icon: <Search size={24} />, title: 'Keyword Research', text: 'Explore keyword ideas, questions, competitor keywords and SERP features for your market.' },
  { icon: <Layers size={24} />, title: 'AI Search (GEO)', text: 'Track how your brand appears in AI search experiences, with citations and mentions over time.' },
  { icon: <Target size={24} />, title: 'Content Strategy', text: 'Turn research into briefs and plans that are tied to the projects they support.' },
  { icon: <BarChart3 size={24} />, title: 'Reports', text: 'Generate, schedule and share reports that show what changed and what still needs work.' },
];

export default function HomePage() {
  return (
    <>
      <Hero
        eyebrow="SEO Engineering"
        title="Audit, optimize and verify your search visibility"
        actions={
          <>
            <ButtonLink href="/app" variant="green" size="lg">
              Get Started Free
            </ButtonLink>
            <ButtonLink href="/pricing" variant="greenOutline" size="lg">
              View Pricing
            </ButtonLink>
          </>
        }
      >
        AmpliVerify brings core SEO and AI-search workflows into one structured system, so you can find issues, prioritize work, improve content and review progress without jumping between tools.
      </Hero>

      <section className={s.section} id="features">
        <div className={`${s.container} ${s.center}`}>
          <div className={s.eyebrow}>Features</div>
          <h2 className={s.h2}>One workflow from analysis to action</h2>
          <p className={s.lead}>Each module feeds the next, so findings become prioritized work and work becomes verified results.</p>
          <div className={`${s.cards} ${s.cards3}`} style={{ textAlign: 'left' }}>
            {FEATURES.map((f) => (
              <div key={f.title} className={s.cardx}>
                <div className={s.iconbox}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${s.section} ${s.sectionAlt}`} id="how-it-works">
        <div className={`${s.container} ${s.twocol}`}>
          <div>
            <div className={s.eyebrow}>How it works</div>
            <h2 className={s.h2}>Audit. Optimize. Verify.</h2>
            <p className={s.lead}>A repeatable process instead of one-time checklists.</p>
            <NumberedList
              items={[
                { title: 'Audit', text: 'Understand page, content and search issues using the data sources available to your project.' },
                { title: 'Optimize', text: 'Turn findings into prioritized recommendations and editing workflows.' },
                { title: 'Verify', text: 'Re-run analysis and use reports to confirm that changes had the intended effect.' },
              ]}
            />
          </div>
          <div className={s.mock}>
            <div className={s.eyebrow}>Responsible guidance</div>
            <h3 style={{ fontSize: 22, color: '#173a63', margin: '10px 0' }}>Clear findings, no guaranteed rankings</h3>
            <p style={{ fontSize: 15, color: '#748394', lineHeight: 1.7 }}>
              Recommendations explain what to change and why. Results are verified with real data, not assumed.
            </p>
            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              {['Every audit run is kept for comparison', 'AI suggestions are advisory and reviewable', 'Usage is metered transparently with credits'].map((t) => (
                <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15, color: '#36536f' }}>
                  <CheckCircle2 size={18} color="var(--brand-green-600)" /> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={`${s.container} ${s.center}`}>
          <h2 className={s.h2}>Start with your first project</h2>
          <p className={s.lead}>Add a website, run an audit and work through the recommendations at your own pace.</p>
          <div className={s.heroActions}>
            <ButtonLink href="/app" variant="green" size="lg">
              Get Started Free
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
