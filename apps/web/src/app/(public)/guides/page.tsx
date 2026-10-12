import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Lightbulb, Megaphone, Search } from 'lucide-react';
import { ArticleCard, Cover, NewsletterBand } from '@/components/public/ArticleParts';
import { apiList, qs } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Guides — Engineering Better Search Growth', description: 'Practical, no-fluff articles on technical SEO, content, AI search and measuring what works.' };

/** Guides / Resources landing (Public_Frontend/Resources_Page). */
export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const [guides, categories] = await Promise.all([apiList<ContentSummary>(`/public/guides${qs({ q, category, limit: 25 })}`), apiList<{ name: string; slug: string }>('/public/categories?type=GUIDE')]);
  const filtered = !!(q || category);
  const [featured, ...rest] = guides;
  const grid = filtered ? guides : rest;
  return (
    <>
      <section className={s.blogHero}>
        <div className={`${s.container} ${s.blogHeroGrid}`}>
          <div>
            <div className={s.eyebrow}>Resources</div>
            <h1 className={s.h1}>Guides for Engineering Better Search Growth</h1>
            <p className={s.lead}>Practical, no-fluff articles on technical SEO, content, AI search and measuring what works.</p>
            <div className={s.filterBar}>
              <form action="/guides" role="search" style={{ maxWidth: 520 }}>
                {category && <input type="hidden" name="category" value={category} />}
                <input name="q" defaultValue={q} placeholder="Search articles..." aria-label="Search guides" />
                <button type="submit" className={`${s.btn} ${s.sm}`} style={{ height: 38, padding: '0 12px' }} aria-label="Search">
                  <Search size={18} />
                </button>
              </form>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }} aria-hidden>
            {[
              [<BookOpen key="g" size={22} />, 'Guides'],
              [<Lightbulb key="t" size={22} />, 'Tips'],
              [<Megaphone key="u" size={22} />, 'Updates'],
            ].map(([icon, l]) => (
              <span key={String(l)} className={s.heroArt} style={{ display: 'flex', gap: 12, alignItems: 'center', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--g900)', padding: '14px 18px' }}>
                {icon} {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section} style={{ paddingTop: 40 }}>
        <div className={s.container}>
          {!filtered && featured && (
            <Link href={`/guides/${featured.slug}`} className={s.featured}>
              <Cover imageUrl={featured.imageUrl} alt="" dark badge="Featured Guide" />
              <div>
                <small style={{ color: 'var(--mute)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {featured.category?.name ?? 'Guide'}
                  {featured.readingMinutes ? ` · ${featured.readingMinutes} min read` : ''}
                </small>
                <h2 className={s.h2} style={{ fontSize: 'clamp(24px, 6vw, 32px)' }}>
                  {featured.title}
                </h2>
                {featured.excerpt && <p className={s.cardText}>{featured.excerpt}</p>}
                <span className={s.learn}>
                  Read the Guide <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          )}
          <div className={s.sectionHead}>
            <h2 className={s.h2} style={{ fontSize: 'clamp(24px, 6vw, 30px)', margin: 0 }}>
              {filtered ? 'Results' : 'Latest Articles'}
            </h2>
            {categories.length > 0 && (
              <nav className={s.chips} aria-label="Topics">
                <Link href="/guides" aria-current={!category}>
                  All
                </Link>
                {categories.map((c) => (
                  <Link key={c.slug} href={`/guides?category=${encodeURIComponent(c.slug)}`} aria-current={category === c.slug}>
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          {guides.length === 0 ? (
            <div className={s.card} style={{ textAlign: 'center' }}>
              <h3 className={s.cardTitle}>{filtered ? 'No matches' : 'No guides published yet'}</h3>
              <p className={s.cardText}>{filtered ? 'Try a different search or topic.' : 'New guides will appear here as they are published.'}</p>
            </div>
          ) : (
            grid.length > 0 && (
              <div className={s.posts}>
                {grid.map((g, i) => (
                  <ArticleCard key={g.slug} item={g} href={`/guides/${g.slug}`} showAuthor={false} dark={i % 3 === 2} />
                ))}
              </div>
            )
          )}
        </div>
      </section>

      <NewsletterBand title="One Useful SEO Idea, Every Two Weeks" text="Get practical SEO tips, guides, and product updates. No spam. Unsubscribe anytime." source="guides" />
    </>
  );
}
