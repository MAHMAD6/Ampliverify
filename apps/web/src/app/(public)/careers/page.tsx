import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Code2, Target, Users } from 'lucide-react';
import { CtaBand, PageHero } from '@/components/public/Blocks';
import { jobChips } from '@/components/public/jobs';
import { apiList } from '@/lib/api';
import type { JobSummary } from '@/lib/types';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Careers' };

/**
 * Careers (public-website-v2/08). Openings come only from the Super Admin
 * Careers workflow (published, visible, before deadline). The design's
 * placeholder benefits are omitted until approved benefits exist.
 */
export default async function CareersPage() {
  const jobs = await apiList<JobSummary>('/public/careers');
  return (
    <>
      <PageHero
        center
        eyebrow="Careers"
        title={
          <>
            Help Us Build the Future of <span className={s.green}>SEO Engineering</span>
          </>
        }
        lead="We're a small team bringing the rigor of software engineering to search growth. If that excites you, we'd love to meet you."
      >
        <div className={s.heroActions}>
          <a href="#openings" className={s.btn}>
            See Open Roles <ArrowDown size={18} />
          </a>
        </div>
      </PageHero>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.eyebrow}>Why Join Us</div>
          <h2 className={s.h2}>How We Work</h2>
          <div className={s.grid3} style={{ marginTop: 24 }}>
            {[
              ['Engineering-Led', 'We measure, prioritize and test — in our product and in how we make decisions.', <Code2 key="c" size={22} />],
              ['Real Ownership', "Small team, big scope. You'll own meaningful parts of the product end to end.", <Target key="t" size={22} />],
              ['Customer Obsessed', 'We judge our work by the results our customers see in search.', <Users key="u" size={22} />],
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
      <section id="openings" style={{ paddingBottom: 40 }}>
        <div className={s.container}>
          <div className={s.sectionHead}>
            <div>
              <div className={s.eyebrow}>Open Roles</div>
              <h2 className={s.h2}>Current Openings</h2>
            </div>
            <small style={{ color: 'var(--mute)' }}>
              {jobs.length} open position{jobs.length === 1 ? '' : 's'}
            </small>
          </div>
          {jobs.length ? (
            <div className={s.roles}>
              {jobs.map((j) => (
                <div key={j.slug} className={s.role}>
                  <div>
                    <h3>{j.title}</h3>
                    <div className={s.pills}>
                      {jobChips(j).map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </div>
                  </div>
                  <Link href={`/careers/${j.slug}`} className={`${s.btnOutline} ${s.sm}`}>
                    Apply <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className={s.card} style={{ textAlign: 'center' }}>
              <h3 className={s.cardTitle}>No open roles right now</h3>
              <p className={s.cardText}>New openings will appear here as soon as they are published.</p>
            </div>
          )}
        </div>
      </section>
      <CtaBand title="Don't See the Right Role?" text="Tell us what you'd bring to AmpliVerify. We read every message." primary={{ label: 'Get in Touch', href: '/contact?topic=careers' }} />
    </>
  );
}
