import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CtaBand, TrendArt } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'About Us' };

const PRINCIPLES = [
  ['Measure First', 'Every recommendation starts from data about your site, not a generic checklist.'],
  ['Prioritize by Impact', 'Time is limited. We rank work by what will move results the most.'],
  ['Verify Everything', "A fix isn't done until it's live and measured. That's where our name comes from."],
  ['Your Data Is Yours', 'Clear permissions and security built in, so you stay in control of your data.'],
];

/**
 * About (public-website-v2/07). The founding story, company facts (year,
 * city, team size) and team cards are placeholders in the design, so they are
 * omitted until real, approved content exists.
 */
export default function AboutPage() {
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.heroGrid}`}>
          <div>
            <div className={s.eyebrow}>About AmpliVerify</div>
            <h1 className={s.h1}>
              SEO Should Be Engineered, <span className={s.green}>Not Guessed</span>
            </h1>
          </div>
          <p className={s.lead}>We started AmpliVerify because most SEO advice is a pile of to-dos with no order and no proof. We build tools that bring the rigor of software engineering — measurement, prioritization and testing — to search growth.</p>
        </div>
      </section>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.eyebrow}>What We Believe</div>
          <h2 className={s.h2}>Four Principles Behind Every Feature</h2>
          <div className={s.grid4} style={{ marginTop: 24 }}>
            {PRINCIPLES.map(([t, x], i) => (
              <div key={t} className={s.card}>
                <small style={{ color: 'var(--g900)', fontWeight: 700 }}>0{i + 1}</small>
                <h3 className={s.cardTitle}>{t}</h3>
                <p className={s.cardText}>{x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className={s.sectionAlt}>
        <div className={`${s.container} ${s.split}`}>
          <div className={s.cover} style={{ height: 300, borderRadius: 20, overflow: 'hidden', background: 'var(--g900)' }}>
            <TrendArt dark />
          </div>
          <div>
            <div className={s.eyebrow}>Our Story</div>
            <h2 className={s.h2}>Built by Engineers Who Got Tired of Guessing</h2>
            <p className={s.lead}>Today we help businesses turn their websites into dependable growth engines — with a process they can see, trust and repeat.</p>
            <Link href="/careers" className={s.learn}>
              We&apos;re Hiring <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <CtaBand eyebrow="Work With Us" title="Want to See the Approach in Action?" text="Run a free audit or get in touch with the team." secondary={{ label: 'Contact Us', href: '/contact' }} />
    </>
  );
}
