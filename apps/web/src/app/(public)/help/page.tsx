import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, CreditCard, MessageSquare, Search, Settings2, Sparkles, Target } from 'lucide-react';
import { apiList, qs } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Help Center' };

/** Topic layout from the design; each topic lists the published help articles in matching categories. */
const TOPICS = [
  { title: 'Getting Started', match: /start|account|setup|connect/i, icon: <Check size={22} /> },
  { title: 'Website Audit', match: /audit/i, icon: <Search size={22} /> },
  { title: 'Optimization & Editor', match: /optim|editor|recommend/i, icon: <Settings2 size={22} /> },
  { title: 'Keywords & Content', match: /keyword|content/i, icon: <Target size={22} /> },
  { title: 'AI Search (GEO)', match: /geo|ai search/i, icon: <Sparkles size={22} /> },
  { title: 'Account & Billing', match: /bill|plan|credit|invoice|account/i, icon: <CreditCard size={22} /> },
];

/**
 * Help Center (public-website-v2/10). Topic cards show real published help
 * articles grouped by their category; empty topics say so instead of listing
 * placeholder article titles.
 */
export default async function HelpCenterPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const [articles, all] = await Promise.all([apiList<ContentSummary>(`/public/help${qs({ q, category, limit: 50 })}`), q || category ? Promise.resolve([] as ContentSummary[]) : apiList<ContentSummary>('/public/help?limit=50')]);
  const searching = !!(q || category);
  const byTopic = TOPICS.map((t) => ({ ...t, items: all.filter((a) => t.match.test(`${a.category?.name ?? ''} ${a.category?.slug ?? ''}`)).slice(0, 3) }));
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.center}`}>
          <div className={s.eyebrow}>Help Center</div>
          <h1 className={s.h1}>How Can We Help?</h1>
          <form action="/help" role="search" className={s.searchBar}>
            <Search size={20} color="#5d6b7c" style={{ alignSelf: 'center', marginLeft: 8 }} />
            <input name="q" defaultValue={q} placeholder='Search for answers, e.g. "connect my website"' aria-label="Search help articles" />
            <button type="submit" className={`${s.btn} ${s.sm}`}>
              Search
            </button>
          </form>
          <p className={s.popular}>
            Popular:
            <Link href="/help?q=connect">Connect your website</Link>·<Link href="/help?q=audit">Read your audit</Link>·<Link href="/help?q=billing">Billing</Link>
          </p>
        </div>
      </section>
      <section className={s.section}>
        <div className={s.container}>
          {searching ? (
            <>
              <h2 className={s.h2} style={{ fontSize: 30 }}>
                {articles.length ? `Results for “${q ?? category}”` : 'No matching articles'}
              </h2>
              <div className={s.roles} style={{ marginTop: 18 }}>
                {articles.map((a) => (
                  <Link key={a.slug} href={`/help/${a.slug}`} className={s.role}>
                    <span>
                      <h3>{a.title}</h3>
                      {a.excerpt && <p className={s.cardText}>{a.excerpt}</p>}
                    </span>
                    <ChevronRight size={18} />
                  </Link>
                ))}
                {articles.length === 0 && <p className={s.role}>Try different words, or contact support below.</p>}
              </div>
            </>
          ) : (
            <>
              <h2 className={s.h2} style={{ fontSize: 34 }}>
                Browse by Topic
              </h2>
              <div className={s.grid3} style={{ marginTop: 22 }}>
                {byTopic.map((t) => (
                  <div key={t.title} className={s.card}>
                    <div className={s.topicHead}>
                      <span className={s.icon}>{t.icon}</span>
                      <h3>{t.title}</h3>
                    </div>
                    {t.items.length ? (
                      <ul className={s.topicLinks}>
                        {t.items.map((a) => (
                          <li key={a.slug}>
                            <Link href={`/help/${a.slug}`}>
                              {a.title} <ChevronRight size={16} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={s.cardText} style={{ paddingTop: 12 }}>
                        Articles for this topic are being written.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <div className={s.card} style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 56, background: 'var(--g25)', flexWrap: 'wrap' }}>
            <span className={s.icon} style={{ width: 64, height: 64 }}>
              <MessageSquare size={26} />
            </span>
            <div style={{ flex: 1 }}>
              <h3 className={s.cardTitle} style={{ margin: 0 }}>
                Still Need Help?
              </h3>
              <p className={s.cardText}>Our support team is happy to answer your questions.</p>
            </div>
            <Link href="/contact?topic=support" className={s.btn}>
              Contact Support <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
