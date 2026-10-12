import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { ArticleCard, Byline, Cover, NewsletterBand } from '@/components/public/ArticleParts';
import { apiList, qs } from '@/lib/api';
import type { ContentSummary } from '@/lib/types';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Blog — SEO Insights for Better Search Growth', description: 'Actionable insights, strategies, and updates to help you improve search visibility and grow your website.' };

/** Blog landing (Public_Frontend/Blog Landing Page). */
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const [posts, categories] = await Promise.all([apiList<ContentSummary>(`/public/blog${qs({ q, category, limit: 25 })}`), apiList<{ name: string; slug: string }>('/public/categories?type=BLOG')]);
  const filtered = !!(q || category);
  const [featured, ...rest] = posts;
  const grid = filtered ? posts : rest;
  return (
    <>
      <section className={s.blogHero}>
        <div className={s.container}>
          <div className={s.blogHeroGrid}>
            <div>
              <span className={s.badge}>Blog</span>
              <h1 className={s.h1}>SEO Insights for Better Search Growth</h1>
              <p className={s.lead}>Actionable insights, strategies, and updates to help you improve search visibility and grow your website.</p>
            </div>
            <div className={s.heroArt} aria-hidden>
              <svg viewBox="0 0 240 150" style={{ width: '100%' }}>
                <rect x="10" y="10" width="160" height="10" rx="5" fill="#e3e9e5" />
                <rect x="10" y="30" width="120" height="8" rx="4" fill="#e3e9e5" />
                {[40, 60, 80, 100, 120].map((h, i) => (
                  <rect key={h} x={20 + i * 26} y={140 - h} width="18" height={h} rx="3" fill={i > 2 ? '#15803d' : '#5cc28a'} />
                ))}
                <circle cx="190" cy="70" r="26" fill="none" stroke="#0e5e2b" strokeWidth="8" />
                <line x1="208" y1="88" x2="230" y2="112" stroke="#0e5e2b" strokeWidth="10" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className={s.filterBar} id="search">
            <form action="/blog" role="search">
              <Search size={20} color="#5d6b7c" aria-hidden />
              {category && <input type="hidden" name="category" value={category} />}
              <input name="q" defaultValue={q} placeholder="Search blog articles..." aria-label="Search blog articles" />
            </form>
            {categories.length > 0 && (
              <nav className={s.chips} aria-label="Topics">
                <Link href="/blog" aria-current={!category}>
                  All
                </Link>
                {categories.map((c) => (
                  <Link key={c.slug} href={`/blog?category=${encodeURIComponent(c.slug)}`} aria-current={category === c.slug}>
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>
      </section>

      <section className={s.section} style={{ paddingTop: 40 }}>
        <div className={s.container}>
          {!filtered && featured && (
            <Link href={`/blog/${featured.slug}`} className={s.featuredBlog}>
              <Cover imageUrl={featured.imageUrl} alt="" dark />
              <div style={{ display: 'grid', gap: 12 }}>
                {featured.category && <span className={s.chipSm}>{featured.category.name}</span>}
                <h2 className={s.h2} style={{ fontSize: 'clamp(24px, 6vw, 34px)', margin: 0 }}>
                  {featured.title}
                </h2>
                {featured.excerpt && <p className={s.cardText} style={{ fontSize: 16 }}>{featured.excerpt}</p>}
                <div className={s.cardFoot}>
                  <Byline item={featured} />
                  <span className={s.roundArrow} aria-hidden>
                    <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            </Link>
          )}
          <div className={s.sectionHead}>
            <h2 className={s.h2} style={{ fontSize: 'clamp(24px, 6vw, 30px)', margin: 0 }}>
              {filtered ? 'Results' : 'Latest Articles'}
            </h2>
            {filtered && (
              <Link href="/blog" className={s.learn}>
                View all articles <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {posts.length === 0 ? (
            <div className={s.card} style={{ textAlign: 'center' }}>
              <h3 className={s.cardTitle}>{filtered ? 'No matches' : 'No articles published yet'}</h3>
              <p className={s.cardText}>{filtered ? 'Try a different search or topic.' : 'New articles will appear here as they are published.'}</p>
            </div>
          ) : (
            grid.length > 0 && (
              <div className={s.posts}>
                {grid.map((p, i) => (
                  <ArticleCard key={p.slug} item={p} href={`/blog/${p.slug}`} dark={i % 3 === 0} />
                ))}
              </div>
            )
          )}
        </div>
      </section>

      <NewsletterBand eyebrow="Stay Updated" title="Get the Latest SEO Insights" text="Join our newsletter for new articles, SEO tips, and product updates." source="blog" />
    </>
  );
}
