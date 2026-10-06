import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Briefcase, Clock, MapPin } from 'lucide-react';
import { Markdown } from '@/components/public/Markdown';
import { apiGet } from '@/lib/api';
import { formatDate, humanize } from '@/lib/format';
import type { JobDetail } from '@/lib/types';
import s from '@/components/public/site.module.css';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const result = await apiGet<JobDetail>(`/public/careers/${encodeURIComponent(slug)}`);
  if (!result.ok) notFound();
  return result.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await load((await params).slug);
  return { title: job.seoTitle ?? job.title, description: job.metaDescription ?? job.summary ?? undefined };
}

/**
 * Job Detail + Application (public-careers-application/01). Everything shown
 * comes from the published job record; unpublished or closed roles 404 in the
 * API. The application endpoint (private storage, validated résumé upload)
 * is not built yet, so Submit is disabled — success is only ever shown after
 * a confirmed backend submission (see ./applied).
 */
export default async function JobPage({ params }: Props) {
  const job = await load((await params).slug);
  const closed = !!job.applicationDeadline && new Date(job.applicationDeadline) < new Date();
  const facts: [React.ReactNode, string, string | null][] = [
    [<MapPin key="l" size={18} />, 'Location', job.locationText],
    [<Briefcase key="e" size={18} />, 'Employment Type', humanize(job.employmentType)],
    [<Clock key="w" size={18} />, 'Work Arrangement', job.workArrangement && humanize(job.workArrangement)],
  ];
  return (
    <>
      <header className={s.articleHero}>
        <div className={s.container}>
          <nav className={s.crumbs} aria-label="Breadcrumb">
            <Link href="/about">Company</Link> › <Link href="/careers">Careers</Link> › <span>Job Opening</span>
          </nav>
          <div className={s.eyebrow} style={{ marginTop: 18 }}>
            Careers{job.department && ` · ${job.department}`}
          </div>
          <h1 className={s.h1}>{job.title}</h1>
          {job.summary && <p className={s.lead}>{job.summary}</p>}
          <div className={s.pills} style={{ marginTop: 18 }}>
            {facts.map(([i, k, v]) => (
              <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 14, padding: '6px 12px' }}>
                {i} {k}: {v ?? '—'}
              </span>
            ))}
          </div>
        </div>
      </header>
      <section className={s.section} style={{ paddingTop: 40 }}>
        <div className={s.container} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 40, alignItems: 'start' }}>
          <div>
            {job.description ? <Markdown source={job.description} /> : <p className={s.pending}>The full role description will be available soon.</p>}
            {job.compensationText && (
              <>
                <h2 className={s.cardTitle} style={{ marginTop: 28 }}>
                  Compensation &amp; Benefits
                </h2>
                <p className={s.cardText}>{job.compensationText}</p>
              </>
            )}
            {job.applicationDeadline && (
              <p className={s.cardText} style={{ marginTop: 20 }}>
                {closed ? 'Applications closed on' : 'Apply by'} {formatDate(job.applicationDeadline)}.
              </p>
            )}
          </div>
          <form className={`${s.card} ${s.form}`} style={{ padding: 32, position: 'sticky', top: 100 }}>
            <div className={s.full}>
              <h2 className={s.cardTitle} style={{ marginTop: 0 }}>
                Apply for this role
              </h2>
              <p className={s.cardText}>Submit the information required for this opening. Optional fields are marked.</p>
            </div>
            <label>
              <span>
                First name <span className={s.req}>*</span>
              </span>
              <input className={s.input} name="firstName" required placeholder="Enter first name" autoComplete="given-name" />
            </label>
            <label>
              <span>
                Last name <span className={s.req}>*</span>
              </span>
              <input className={s.input} name="lastName" required placeholder="Enter last name" autoComplete="family-name" />
            </label>
            <label className={s.full}>
              <span>
                Email address <span className={s.req}>*</span>
              </span>
              <input className={s.input} name="email" type="email" required placeholder="Enter your email" autoComplete="email" />
            </label>
            <label className={s.full}>
              Phone number (optional)
              <input className={s.input} name="phone" type="tel" placeholder="Enter phone number" autoComplete="tel" />
            </label>
            <label className={s.full}>
              <span>
                Résumé / CV {job.requireResume ? <span className={s.req}>*</span> : '(optional)'}
              </span>
              <input className={s.input} name="resume" type="file" required={job.requireResume} accept=".pdf,.doc,.docx" style={{ paddingTop: 13 }} />
              <small style={{ fontWeight: 400, color: 'var(--mute)' }}>PDF or Word document.</small>
            </label>
            <label>
              LinkedIn profile (optional)
              <input className={s.input} name="linkedinUrl" type="url" placeholder="Profile URL" />
            </label>
            <label>
              Portfolio / website (optional)
              <input className={s.input} name="websiteUrl" type="url" placeholder="Website URL" />
            </label>
            <label className={s.full}>
              <span>
                {job.requireCoverLetter ? 'Cover letter' : 'Message'} {job.requireCoverLetter ? <span className={s.req}>*</span> : '(optional)'}
              </span>
              <textarea className={s.input} name="message" required={job.requireCoverLetter} placeholder="Add a short note relevant to your application." />
            </label>
            <p className={`${s.full} ${s.cardText}`} style={{ fontSize: 13 }}>
              By submitting this application, you acknowledge that the information you provide will be processed for recruitment purposes in accordance with the AmpliVerify <Link href="/legal#privacy">privacy notice</Link>.
            </p>
            <label className={s.full} style={{ display: 'flex', gap: 10, fontWeight: 400 }}>
              <input type="checkbox" name="consent" required /> I confirm that the information provided is accurate and I agree to the application privacy terms.
            </label>
            <div className={s.full} style={{ display: 'grid', gap: 10 }}>
              <button type="submit" className={s.btn} disabled>
                Submit Application
              </button>
              <p className={s.notice}>{closed ? 'This role is no longer accepting applications.' : 'Online applications are not open yet for this role.'}</p>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
