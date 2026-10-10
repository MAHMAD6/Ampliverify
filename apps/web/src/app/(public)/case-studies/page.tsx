import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CtaBand, PageHero } from '@/components/public/Blocks';
import { apiList } from '@/lib/api';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Case Studies', description: 'How teams improved search and AI search visibility with AmpliVerify.' };

type CaseStudy = { slug: string; title: string; customerName: string; industry: string | null; summary: string | null; coverMediaId: string | null; resultsJson: { label: string; value: string }[] | null };

/** Published customer stories (admin → Case Studies). */
export default async function CaseStudiesPage() {
  const items = await apiList<CaseStudy>('/public/case-studies?limit=48');
  return (
    <>
      <PageHero eyebrow="Case Studies" title="Results from real teams" lead="How customers use AmpliVerify to find, fix and verify what holds their visibility back." />
      <section className={s.section} style={{ paddingTop: 20 }}>
        <div className={s.container}>
          {items.length === 0 ? (
            <div className={s.card} style={{ textAlign: 'center' }}>
              <h2 className={s.cardTitle}>Case studies are on the way</h2>
              <p className={s.cardText}>Published customer stories will appear here.</p>
            </div>
          ) : (
            <div className={s.grid3}>
              {items.map((c) => (
                <Link key={c.slug} href={`/case-studies/${c.slug}`} className={s.card} style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                  {c.coverMediaId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/media/${c.coverMediaId}`} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10 }} />
                  )}
                  <span className={s.eyebrow} style={{ fontSize: 12 }}>
                    {c.customerName}
                    {c.industry ? ` · ${c.industry}` : ''}
                  </span>
                  <h2 className={s.cardTitle} style={{ margin: 0 }}>
                    {c.title}
                  </h2>
                  {c.summary && <p className={s.cardText}>{c.summary}</p>}
                  {c.resultsJson?.length ? (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {c.resultsJson.slice(0, 3).map((r) => (
                        <span key={r.label}>
                          <b style={{ display: 'block', fontSize: 22, color: 'var(--g900)' }}>{r.value}</b>
                          <small style={{ color: 'var(--mute)' }}>{r.label}</small>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className={s.learn}>
                    Read the story <ArrowRight size={16} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <CtaBand title="See what you could fix first" text="Run a free audit and get a ranked plan for your site." />
    </>
  );
}
