import type { Metadata } from 'next';
import Link from 'next/link';
import { Hero, NumberedList } from '@/components/public/Hero';
import { EmptyContent } from '@/components/public/ContentList';
import { apiList } from '@/lib/api';
import { jobChips } from '@/components/public/jobs';
import type { JobSummary } from '@/lib/types';
import s from '@/components/public/public.module.css';

export const metadata: Metadata = { title: 'Careers' };

/** Openings come only from the Super Admin Careers workflow (published, visible, before deadline). */
export default async function CareersPage() {
  const jobs = await apiList<JobSummary>('/public/careers');
  return (
    <>
      <Hero eyebrow="Careers" title="Build the future of SEO engineering with AmpliVerify">
        Explore open roles and learn how AmpliVerify approaches product, technology, and growth.
      </Hero>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.twocol}>
            <div>
              <div className={s.eyebrow}>Working at AmpliVerify</div>
              <h2 className={s.h2}>Small-team clarity, product-focused work</h2>
              <NumberedList
                items={[
                  { title: 'Customer-focused problem solving', text: 'Build around clear user needs and measurable product behavior.' },
                  { title: 'Responsible product development', text: 'Avoid unsupported claims and keep security, privacy, and reliability in scope.' },
                  { title: 'Continuous improvement', text: 'Use feedback, data, and iteration to improve the product over time.' },
                ]}
              />
            </div>
            <div className={s.mock}>
              <div className={s.eyebrow}>Open roles</div>
              <h3 style={{ fontSize: 24, color: '#173a63', margin: '10px 0' }}>Current opportunities</h3>
              <p style={{ fontSize: 16, color: '#748394', lineHeight: 1.7 }}>
                {jobs.length
                  ? `${jobs.length} open role${jobs.length === 1 ? '' : 's'} listed below.`
                  : 'There are no open positions right now. Check back later for new roles.'}
              </p>
            </div>
          </div>

          {jobs.length > 0 ? (
            <div className={s.jobgrid}>
              {jobs.map((job) => (
                <Link key={job.slug} href={`/careers/${job.slug}`} className={s.jobcard}>
                  <h3>{job.title}</h3>
                  <div className={s.jobmeta}>
                    {jobChips(job).map((c) => (
                      <span key={c} className={s.chip}>
                        {c}
                      </span>
                    ))}
                  </div>
                  {job.summary && <p style={{ fontSize: 15, color: '#748394' }}>{job.summary}</p>}
                  <div className={s.read}>View role →</div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 34 }}>
              <EmptyContent title="No open positions currently published" text="When a role opens, its title, location, employment type and summary will appear here." />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
