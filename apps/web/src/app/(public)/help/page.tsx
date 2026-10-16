import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ChevronRight, CreditCard, FileText, MessageSquare, Search, Settings, Sparkles, Target, User } from 'lucide-react';
import { ArtHero } from '@/components/public/HeroArt';
import { apiList, qs } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';
import site from '@/components/public/site.module.css';
import s from '@/components/public/pages.module.css';

export const metadata: Metadata = { title: 'Help Center' };

const TOPICS = [
  { title: 'Getting Started', text: 'Set up your account and get up and running quickly.', icon: <User size={26} />, links: ['Create your account', 'Connect your website', 'Configure basic settings'] },
  { title: 'Website Audit', text: 'Learn how to run and understand your site audit results.', icon: <Search size={26} />, links: ['Run your first audit', 'Understand your audit report', 'Improve your site health score'] },
  { title: 'On-Page SEO Editor', text: 'Optimize your content with real-time recommendations.', icon: <Settings size={26} />, links: ['Use the On-Page SEO Editor', 'Optimize content for keywords', 'Save and apply your changes'] },
  { title: 'Keywords & Content', text: 'Find and target the right keywords and optimize your content.', icon: <Target size={26} />, links: ['Find keywords to target', 'Plan content with Content Strategy', 'Track keyword rankings'] },
  { title: 'AI Search (GEO)', text: 'Understand AI search and optimize for generative search.', icon: <Sparkles size={26} />, links: ['What GEO is and how it works', 'Set up GEO prompt tracking', 'Make your pages AI-ready'] },
  { title: 'Account & Billing', text: 'Manage your plan, payments, credits, and account settings.', icon: <CreditCard size={26} />, links: ['Change or cancel your plan', 'How credits work', 'Download your invoices'] },
];

const RESOURCES = [
  ['How to connect your website', 'Step-by-step setup guide'],
  ['Understanding your audit report', 'Learn what the scores mean'],
  ['Using the On-Page SEO Editor', 'Optimize and apply your changes'],
  ['Introduction to GEO', 'Get started with AI search'],
] as const;

const POPULAR = ['Connect your website', 'Run your first audit', 'Use the editor', 'Billing'];

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Help Center (Public_Frontend "Help Center"). Each topic link opens the
 * published help article with that title, or searches the help articles when
 * none has been published yet.
 */
export default async function HelpCenterPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const searching = q !== undefined || !!category;
  const [results, all] = await Promise.all([searching ? apiList<ContentSummary>(`/public/help${qs({ q, category, limit: 50 })}`) : Promise.resolve([] as ContentSummary[]), apiList<ContentSummary>('/public/help?limit=100')]);
  const bySlug = new Map(all.map((a) => [norm(a.title), a.slug]));
  const href = (title: string) => {
    const slug = bySlug.get(norm(title));
    return slug ? `/help/${slug}` : `/help?q=${encodeURIComponent(title)}`;
  };
  return (
    <>
      <ArtHero
        art="help"
        eyebrow="Help Center"
        title={
          <>
            How Can We <em>Help?</em>
          </>
        }
        lead="Find answers, step-by-step guides, and helpful resources to get the most out of AmpliVerify."
      >
        <form action="/help" role="search" className={s.search}>
          <Search size={20} />
          <input name="q" defaultValue={q} placeholder='Search for answers, e.g. "connect my website"' aria-label="Search help articles" maxLength={120} />
          <button type="submit" className={`${site.btn} ${site.sm}`}>
            Search
          </button>
        </form>
        <div className={s.popular}>
          Popular:
          {POPULAR.map((p) => (
            <Link key={p} href={`/help?q=${encodeURIComponent(p)}`}>
              {p}
            </Link>
          ))}
        </div>
      </ArtHero>

      {searching ? (
        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.headRow}>
              <h2 className={s.h2}>{!q && !category ? 'All Help Articles' : results.length ? `Results for “${q || category}”` : 'No matching articles'}</h2>
              <Link href="/help" className={s.link}>
                All topics <ArrowRight size={16} />
              </Link>
            </div>
            <div className={s.results} style={{ marginTop: 16 }}>
              {results.map((a) => (
                <Link key={a.slug} href={`/help/${a.slug}`} className={`${s.card} ${s.result}`}>
                  <span>
                    <h3>{a.title}</h3>
                    {a.excerpt && <p>{a.excerpt}</p>}
                  </span>
                  <ChevronRight size={20} />
                </Link>
              ))}
              {results.length === 0 && <p className={`${s.card} ${s.muted}`}>Try different words, or contact our support team below.</p>}
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className={s.section} style={{ paddingBottom: 24 }}>
            <div className={s.wrap}>
              <div className={s.eyebrow}>Browse by Topic</div>
              <h2 className={s.h2}>Explore Help Topics</h2>
              <p className={s.sub}>Get step-by-step guidance, tutorials, and answers to common questions.</p>
              <div className={s.grid3} style={{ marginTop: 22 }}>
                {TOPICS.map((t) => (
                  <div key={t.title} className={s.card} style={{ paddingBottom: 10 }}>
                    <div className={s.topicHead}>
                      <span className={s.circle}>{t.icon}</span>
                      <div>
                        <h3>{t.title}</h3>
                        <p>{t.text}</p>
                      </div>
                    </div>
                    <ul className={s.topicLinks}>
                      {t.links.map((l) => (
                        <li key={l}>
                          <Link href={href(l)}>
                            {l} <ChevronRight size={18} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className={s.sectionTight}>
            <div className={s.wrap}>
              <div className={s.headRow}>
                <div>
                  <div className={s.eyebrow}>Popular Articles</div>
                  <h2 className={s.h2}>Helpful Resources</h2>
                </div>
                <Link href="/help?q=" className={s.link}>
                  View All Articles <ArrowRight size={16} />
                </Link>
              </div>
              <div className={s.grid4} style={{ marginTop: 16 }}>
                {RESOURCES.map(([t, sub]) => (
                  <Link key={t} href={href(t)} className={s.resource}>
                    <span className={s.docIcon}>
                      <FileText size={20} />
                    </span>
                    <span>
                      <b>{t}</b>
                      <small>{sub}</small>
                    </span>
                    <ChevronRight size={18} />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <section className={s.section} style={{ paddingTop: 12 }}>
        <div className={s.wrap}>
          <div className={s.helpBar}>
            <span className={s.circle} style={{ width: 64, height: 64, background: '#fff' }}>
              <MessageSquare size={28} />
            </span>
            <div className={s.grow}>
              <h3>Still Need Help?</h3>
              <p>Can’t find what you’re looking for? Our support team is here to help.</p>
            </div>
            <Link href="/contact?topic=support" className={site.btn}>
              Contact Support <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
