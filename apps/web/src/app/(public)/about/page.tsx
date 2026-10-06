import type { Metadata } from 'next';
import { CircleCheckBig, Compass, Eye, RefreshCw } from 'lucide-react';
import { Hero, NumberedList } from '@/components/public/Hero';
import s from '@/components/public/public.module.css';

export const metadata: Metadata = { title: 'About Us' };

const VALUES = [
  { icon: <Eye size={22} />, title: 'Clarity', text: 'Present findings in a form users can understand and act on.' },
  { icon: <CircleCheckBig size={22} />, title: 'Verification', text: 'Encourage users to review outcomes rather than assume improvement.' },
  { icon: <RefreshCw size={22} />, title: 'Continuous Improvement', text: 'Support repeated analysis and refinement instead of one-time audits.' },
  { icon: <Compass size={22} />, title: 'Responsible Guidance', text: 'Keep recommendations useful without promising guaranteed rankings or traffic.' },
];

export default function AboutPage() {
  return (
    <>
      <Hero eyebrow="About AmpliVerify" title="SEO engineering built around a repeatable workflow">
        AmpliVerify is designed to help users move from analysis to action through a structured process: audit, optimize, and verify.
      </Hero>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.twocol}>
            <div>
              <div className={s.eyebrow}>Our approach</div>
              <h2 className={s.h2}>From scattered SEO tasks to one structured system</h2>
              <p className={s.lead}>
                The product brings core SEO workflows into one experience so users can identify issues, prioritize work, improve content, and review progress without jumping between disconnected processes.
              </p>
              <NumberedList
                items={[
                  { title: 'Audit', text: 'Understand page, content, and search issues using available data sources.' },
                  { title: 'Optimize', text: 'Turn findings into prioritized recommendations and editing workflows.' },
                  { title: 'Verify', text: 'Use reports and repeat analysis to review progress over time.' },
                ]}
              />
            </div>
            <div className={s.mock}>
              <div className={s.eyebrow}>SEO Engineering</div>
              <h3 style={{ fontSize: 26, color: '#173a63', margin: '12px 0' }}>AUDIT • OPTIMIZE • VERIFY</h3>
              <p style={{ fontSize: 16, color: '#748394', lineHeight: 1.7 }}>
                A disciplined product philosophy focused on making SEO work easier to understand, prioritize, and repeat.
              </p>
            </div>
          </div>
          <div className={s.cards}>
            {VALUES.map((v) => (
              <div key={v.title} className={s.cardx}>
                <div className={s.iconbox}>{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
