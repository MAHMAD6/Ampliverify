import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, Briefcase, CalendarDays, Clock, Code2, Laptop, Lightbulb, MapPin, UserCheck, Users } from 'lucide-react';
import { ArtHero } from '@/components/public/HeroArt';
import { humanize } from '@/lib/format';
import { apiList } from '@/lib/api';
import type { JobSummary } from '@/lib/types';
import site from '@/components/public/site.module.css';
import s from '@/components/public/pages.module.css';

export const metadata: Metadata = { title: 'Careers' };

const VALUES = [
  { icon: <Code2 size={26} />, title: 'Engineering-Led', text: 'We make data-driven decisions, build scalable solutions, and ship high-quality software.' },
  { icon: <Lightbulb size={26} />, title: 'Meaningful Impact', text: 'Your work helps businesses grow through better content, visibility, and performance.' },
  { icon: <UserCheck size={26} />, title: 'Customer Focused', text: 'We build for real users and businesses, solving problems that matter.' },
];

const PERKS = [
  { icon: <Laptop size={26} />, label: 'Remote-friendly' },
  { icon: <Clock size={26} />, label: 'Flexible hours' },
  { icon: <BarChart3 size={26} />, label: 'Learning & growth' },
  { icon: <Users size={26} />, label: 'Inclusive team' },
];

/** Careers (Public_Frontend "Careers"). Openings come only from the Super Admin Careers workflow (published, visible, before deadline). */
export default async function CareersPage() {
  const jobs = await apiList<JobSummary>('/public/careers');
  return (
    <>
      <ArtHero
        art="careers"
        eyebrow="Careers"
        title={
          <>
            Help Us Build the Future of <em>SEO Engineering</em>
          </>
        }
        lead="We're a small, focused team applying software engineering and AI to help businesses optimize their content, improve search visibility, and achieve real growth. If that excites you, we'd love to meet you."
      >
        <div style={{ marginTop: 26 }}>
          <a href="#openings" className={site.btn}>
            See Open Roles <ArrowRight size={18} />
          </a>
        </div>
      </ArtHero>

      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.eyebrow}>Why Join Us</div>
          <h2 className={s.h2}>How We Work</h2>
          <div className={s.grid3} style={{ marginTop: 20 }}>
            {VALUES.map((v) => (
              <div key={v.title} className={`${s.card} ${s.valueCard}`}>
                <span className={s.circle} style={{ width: 66, height: 66 }}>
                  {v.icon}
                </span>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
          <div className={s.grid4} style={{ marginTop: 20 }}>
            {PERKS.map((p) => (
              <div key={p.label} className={s.perk}>
                {p.icon} {p.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="openings" className={s.sectionTight} style={{ scrollMarginTop: 90 }}>
        <div className={s.wrap}>
          <div className={s.headRow}>
            <div>
              <div className={s.eyebrow}>Open Roles</div>
              <h2 className={s.h2}>{jobs.length === 1 ? 'Current Opening' : 'Current Openings'}</h2>
            </div>
            <span className={s.muted}>
              {jobs.length} open position{jobs.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
            {jobs.length ? (
              jobs.map((j) => (
                <div key={j.slug} className={`${s.card} ${s.job}`}>
                  <div>
                    <h3>{j.title}</h3>
                    <div className={s.chips}>
                      {j.department && (
                        <span>
                          <Briefcase size={15} /> {j.department}
                        </span>
                      )}
                      {(j.locationText || j.workArrangement) && (
                        <span>
                          <MapPin size={15} /> {j.locationText ?? humanize(j.workArrangement!)}
                        </span>
                      )}
                      <span>
                        <CalendarDays size={15} /> {humanize(j.employmentType)}
                      </span>
                    </div>
                    {j.summary && <p>{j.summary}</p>}
                  </div>
                  <Link href={`/careers/${j.slug}`} className={site.btn}>
                    View Details <ArrowRight size={18} />
                  </Link>
                </div>
              ))
            ) : (
              <div className={s.card} style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: 20 }}>No open roles right now</h3>
                <p className={s.muted}>New openings will appear here as soon as they are published.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={s.section} style={{ paddingTop: 24 }}>
        <div className={s.wrap}>
          <div className={s.band}>
            <h2 className={s.h2}>Don’t See the Right Role?</h2>
            <p>We’re always interested in meeting talented people. Tell us what you’d bring to AmpliVerify and we’ll keep your information on file for future opportunities.</p>
            <Link href="/contact?topic=careers" className={site.btn}>
              Get in Touch <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
