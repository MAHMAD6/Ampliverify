import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { TrendArt } from './Blocks';
import type { ContentSummary } from '@/lib/types';
import s from './site.module.css';

/**
 * Resources index (public-website-v2/05-Resources) for Blog and Guides:
 * newest item featured, topic chips from the category registry, card grid.
 * All items are published records from the public content API.
 */
export function ArticleIndex({
  basePath,
  kind,
  items,
  categories,
  q,
  category,
}: {
  basePath: string;
  kind: 'Article' | 'Guide';
  items: ContentSummary[];
  categories: { name: string; slug: string }[];
  q?: string;
  category?: string;
}) {
  const filtered = !!(q || category);
  const [featured, ...rest] = items;
  const grid = filtered ? items : rest;
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.heroGrid}`} style={{ alignItems: 'end' }}>
          <div>
            <div className={s.eyebrow}>Resources</div>
            <h1 className={s.h1}>Guides for Engineering Better Search Growth</h1>
            <p className={s.lead}>Practical, no-fluff articles on technical SEO, content, AI search and measuring what works.</p>
          </div>
          <form action={basePath} role="search" className={s.searchBar} style={{ margin: 0 }}>
            {category && <input type="hidden" name="category" value={category} />}
            <input name="q" defaultValue={q} placeholder="Search articles" aria-label="Search articles" />
            <button type="submit" className={`${s.btn} ${s.sm}`} aria-label="Search">
              <Search size={18} />
            </button>
          </form>
        </div>
      </section>
      <section className={s.section}>
        <div className={s.container}>
          {!filtered && featured && (
            <Link href={`${basePath}/${featured.slug}`} className={s.featured}>
              <div className={s.cover}>
                <TrendArt dark />
                <span className={s.tagOn} style={{ top: 'auto', bottom: 16 }}>
                  Featured {kind}
                </span>
              </div>
              <div>
                <small style={{ color: 'var(--mute)' }}>{featured.category?.name ?? kind}</small>
                <h2 className={s.h2} style={{ fontSize: 34 }}>
                  {featured.title}
                </h2>
                {featured.excerpt && <p className={s.cardText}>{featured.excerpt}</p>}
                <span className={s.learn}>
                  Read the {kind} <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          )}
          <div className={s.sectionHead}>
            <h2 className={s.h2} style={{ fontSize: 30, margin: 0 }}>
              {filtered ? 'Results' : `Latest ${kind}s`}
            </h2>
            {categories.length > 0 && (
              <nav className={s.chips} aria-label="Topics">
                <Link href={basePath} aria-current={!category}>
                  All
                </Link>
                {categories.map((c) => (
                  <Link key={c.slug} href={`${basePath}?category=${encodeURIComponent(c.slug)}`} aria-current={category === c.slug}>
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          {items.length === 0 ? (
            <div className={s.card} style={{ textAlign: 'center' }}>
              <h3 className={s.cardTitle}>{filtered ? 'No matches' : `No ${kind.toLowerCase()}s published yet`}</h3>
              <p className={s.cardText}>{filtered ? 'Try a different search or topic.' : `New ${kind.toLowerCase()}s will appear here as they are published.`}</p>
            </div>
          ) : (
            grid.length > 0 && (
              <div className={s.posts}>
                {grid.map((p, i) => (
                  <Link key={p.slug} href={`${basePath}/${p.slug}`} className={s.post}>
                    <div className={s.cover}>
                      <TrendArt dark={i % 3 === 2} />
                      {p.category && <span className={s.tagOn}>{p.category.name}</span>}
                    </div>
                    <div className={s.postBody}>
                      <small>{new Date(p.publishedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</small>
                      <h3>{p.title}</h3>
                      {p.excerpt && <p>{p.excerpt}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>
      </section>
      <section style={{ paddingBottom: 80 }}>
        <div className={s.container}>
          <div className={s.ctaDark}>
            <div>
              <h2 className={s.h2}>One Useful SEO Idea, Every Two Weeks</h2>
              <p style={{ color: '#d9efe0' }}>No spam. Unsubscribe anytime.</p>
            </div>
            <form aria-label="Newsletter">
              <input type="email" placeholder="you@company.com" aria-label="Email address" disabled />
              <button type="button" className={s.btnWhite} disabled title="Newsletter sign-up opens soon.">
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
