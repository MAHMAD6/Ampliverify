import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Briefcase, Clock, MapPin } from 'lucide-react';
import { ApplyForm } from '@/components/public/ApplyForm';
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
 * comes from the published job record; unpublished roles 404 in the API.
 * Success is only ever shown after a confirmed backend submission (./applied).
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
          <ApplyForm slug={job.slug} closed={closed} requireResume={job.requireResume} requireCoverLetter={job.requireCoverLetter} />
        </div>
      </section>
    </>
  );
}
