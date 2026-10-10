import type { Metadata } from 'next';
import { CalendarDays, ExternalLink, PlayCircle } from 'lucide-react';
import { CtaBand, PageHero } from '@/components/public/Blocks';
import { apiList } from '@/lib/api';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Webinars & Videos', description: 'Upcoming webinars and on-demand videos about SEO and AI search visibility.' };

type Event = { slug: string; title: string; summary: string | null; eventType: string; startsAt: string; endsAt: string | null; timezone: string; locationText: string | null; registrationUrl: string | null };
type Video = { slug: string; title: string; description: string | null; videoUrl: string; durationSec: number | null; publishedAt: string };

const when = (iso: string, tz: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz || 'UTC' }) + ` ${tz || 'UTC'}`;
const mmss = (n: number | null) => (n === null ? null : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`);

/** Published webinars/events and videos (admin → Webinars & Events, Videos). */
export default async function WebinarsPage() {
  const [events, videos] = await Promise.all([apiList<Event>('/public/events?limit=48'), apiList<Video>('/public/videos?limit=48')]);
  const now = Date.now();
  const upcoming = events.filter((e) => Date.parse(e.endsAt ?? e.startsAt) >= now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const past = events.filter((e) => Date.parse(e.endsAt ?? e.startsAt) < now);
  const eventCard = (e: Event) => (
    <article key={e.slug} className={s.card} style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
      <span className={s.eyebrow} style={{ fontSize: 12 }}>
        {e.eventType.replace(/_/g, ' ').toLowerCase()}
      </span>
      <h3 className={s.cardTitle} style={{ margin: 0 }}>
        {e.title}
      </h3>
      <p className={s.cardText} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <CalendarDays size={16} /> {when(e.startsAt, e.timezone)}
        {e.locationText ? ` · ${e.locationText}` : ''}
      </p>
      {e.summary && <p className={s.cardText}>{e.summary}</p>}
      {e.registrationUrl && Date.parse(e.endsAt ?? e.startsAt) >= now && (
        <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.sm}`} style={{ justifySelf: 'start' }}>
          Register <ExternalLink size={14} />
        </a>
      )}
    </article>
  );
  return (
    <>
      <PageHero eyebrow="Webinars & Videos" title="Learn with the AmpliVerify team" lead="Live sessions and on-demand walkthroughs on audits, optimization and AI search." />
      <section className={s.section} style={{ paddingTop: 20 }}>
        <div className={s.container} style={{ display: 'grid', gap: 40 }}>
          <div>
            <h2 className={s.h2} style={{ fontSize: 28, marginBottom: 16 }}>
              Upcoming
            </h2>
            {upcoming.length ? <div className={s.grid3}>{upcoming.map(eventCard)}</div> : <p className={s.cardText}>No upcoming sessions are scheduled right now.</p>}
          </div>
          <div>
            <h2 className={s.h2} style={{ fontSize: 28, marginBottom: 16 }}>
              On-demand videos
            </h2>
            {videos.length ? (
              <div className={s.grid3}>
                {videos.map((v) => (
                  <a key={v.slug} href={v.videoUrl} target="_blank" rel="noopener noreferrer" className={s.card} style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                    <PlayCircle size={28} color="var(--g900)" />
                    <h3 className={s.cardTitle} style={{ margin: 0 }}>
                      {v.title}
                    </h3>
                    {v.description && <p className={s.cardText}>{v.description}</p>}
                    {mmss(v.durationSec) && <small style={{ color: 'var(--mute)' }}>{mmss(v.durationSec)}</small>}
                  </a>
                ))}
              </div>
            ) : (
              <p className={s.cardText}>Videos will appear here when they are published.</p>
            )}
          </div>
          {past.length > 0 && (
            <div>
              <h2 className={s.h2} style={{ fontSize: 28, marginBottom: 16 }}>
                Past sessions
              </h2>
              <div className={s.grid3}>{past.map(eventCard)}</div>
            </div>
          )}
        </div>
      </section>
      <CtaBand title="Put it into practice" text="Run a free audit and get a ranked plan for your site." />
    </>
  );
}
