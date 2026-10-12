import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowRight, BarChart3, Mail } from 'lucide-react';
import { Markdown } from './Markdown';
import { ArticleCard, Byline, Cover, extractKeyTakeaways, KeyTakeaway, ShareRow, Toc } from './ArticleParts';
import { CommentForm, HelpfulVote, NewsletterForm } from './Engage';
import { apiGet } from '@/lib/api';
import { formatDate, markdownHeadings } from '@/lib/format';
import type { ContentDetail } from '@/lib/types';
import s from './site.module.css';

type Kind = 'blog' | 'guides';

async function pageUrl(kind: Kind, slug: string) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/${kind}/${slug}`;
}

async function Comments({ kind, slug }: { kind: Kind; slug: string }) {
  const r = await apiGet<{ allowComments: boolean; comments: { id: string; authorName: string; body: string; createdAt: string }[] }>(`/public/${kind}/${encodeURIComponent(slug)}/comments`, { revalidate: 30 });
  if (!r.ok || !r.data.allowComments) return null;
  return (
    <section className={s.comments} aria-labelledby="comments-title">
      <h2 id="comments-title" style={{ fontSize: 24 }}>
        Comments {r.data.comments.length > 0 && <small style={{ color: 'var(--mute)', fontWeight: 500 }}>({r.data.comments.length})</small>}
      </h2>
      {r.data.comments.map((c) => (
        <div key={c.id} className={s.comment}>
          <b>{c.authorName}</b>
          <small>{formatDate(c.createdAt)}</small>
          <p>{c.body}</p>
        </div>
      ))}
      <h3 style={{ fontSize: 18 }}>Leave a comment</h3>
      <CommentForm kind={kind} slug={slug} />
    </section>
  );
}

function CtaBox({ wide = false }: { wide?: boolean }) {
  return wide ? (
    <div className={s.articleCta}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span className={s.icon} style={{ background: 'var(--g900)', color: '#fff' }}>
          <BarChart3 size={22} />
        </span>
        <div>
          <b style={{ fontSize: 18 }}>Prioritize Your Own Fixes Automatically</b>
          <p style={{ fontSize: 14, color: 'var(--ink2)' }}>Run a free audit and get a ranked plan for your site.</p>
        </div>
      </div>
      <Link href="/signup" className={s.btn}>
        Get Started Free <ArrowRight size={18} />
      </Link>
    </div>
  ) : (
    <div className={s.sideCta}>
      <span className={s.icon}>
        <BarChart3 size={22} />
      </span>
      <b style={{ fontSize: 20, lineHeight: 1.25 }}>Prioritize Your Own Fixes Automatically</b>
      <p style={{ fontSize: 14, color: 'var(--ink2)' }}>Run a free audit and get a ranked plan for your site in minutes.</p>
      <Link href="/signup" className={s.btn}>
        Get Started Free <ArrowRight size={18} />
      </Link>
    </div>
  );
}

/** Blog post detail (Public_Frontend/Blog_Details): content with a sidebar. */
export async function BlogArticle({ post }: { post: ContentDetail }) {
  const url = await pageUrl('blog', post.slug);
  const { takeaways, rest } = post.showKeyTakeaways !== false ? extractKeyTakeaways(post.body ?? '') : { takeaways: null, rest: post.body ?? '' };
  const headings = post.showToc !== false ? markdownHeadings(rest) : [];
  return (
    <div className={s.container}>
      <nav className={s.crumbs} aria-label="Breadcrumb" style={{ color: 'var(--mute)', paddingTop: 22 }}>
        <Link href="/blog">Blog</Link> /{' '}
        {post.category && (
          <>
            <Link href={`/blog?category=${encodeURIComponent(post.category.slug)}`}>{post.category.name}</Link> /{' '}
          </>
        )}
        <span>{post.title}</span>
      </nav>
      <div className={s.detailGrid}>
        <article>
          {post.category && <span className={s.chipSm}>{post.category.name}</span>}
          <h1 className={s.h1} style={{ fontSize: 'clamp(32px,4vw,48px)', margin: '10px 0' }}>
            {post.title}
          </h1>
          {post.excerpt && <p className={s.lead}>{post.excerpt}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '18px 0' }}>
            <Byline item={post} size={46} />
            <ShareRow url={url} title={post.title} />
          </div>
          {post.imageUrl && <Cover imageUrl={post.imageUrl} alt={post.title} className={s.detailCover} />}
          {takeaways && (
            <KeyTakeaway>
              <b>Key takeaway{/\n\s*[-*]/.test(takeaways) ? 's' : ''}:</b> <Markdown source={takeaways} className={s.inlineProse} />
            </KeyTakeaway>
          )}
          <Markdown source={rest} />
          <Comments kind="blog" slug={post.slug} />
        </article>
        <aside className={s.articleSide}>
          {headings.length > 0 && <Toc headings={headings} numbered />}
          <CtaBox />
          {post.related && post.related.length > 0 && (
            <div className={s.sideCard}>
              <h3>
                Related Articles
                <Link href={post.category ? `/blog?category=${encodeURIComponent(post.category.slug)}` : '/blog'} className={s.learn} style={{ marginTop: 0, fontSize: 13 }}>
                  See all <ArrowRight size={14} />
                </Link>
              </h3>
              {post.related.map((r) => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className={s.relatedRow}>
                  <Cover imageUrl={r.imageUrl} alt="" dark />
                  <span>
                    {r.category && <span className={s.chipSm}>{r.category.name}</span>}
                    <b>{r.title}</b>
                    {r.readingMinutes && <small>{r.readingMinutes} min read</small>}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {post.tags && post.tags.length > 0 && (
            <div className={s.sideCard}>
              <h3>Tags</h3>
              <div className={s.tagPills}>
                {post.tags.map((t) => (
                  <span key={t.slug}>{t.name}</span>
                ))}
              </div>
            </div>
          )}
          <div className={s.sideCard}>
            <h3 style={{ justifyContent: 'flex-start', gap: 10 }}>
              <Mail size={20} color="#15803d" /> Subscribe for More Insights
            </h3>
            <p style={{ fontSize: 13, color: 'var(--mute)', marginBottom: 10 }}>Get the latest articles, SEO tips, and product updates.</p>
            <NewsletterForm source="blog-article" compact />
          </div>
          <div className={s.sideCard}>
            <h3>Share This Article</h3>
            <ShareRow url={url} title={post.title} />
          </div>
          <div className={s.sideCard}>
            <h3>Was This Article Helpful?</h3>
            <p style={{ fontSize: 13, color: 'var(--mute)', marginBottom: 10 }}>Let us know so we can create better content.</p>
            <HelpfulVote kind="blog" slug={post.slug} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Guide detail (Public_Frontend/Guide): sticky contents, content, CTA and related articles. */
export async function GuideArticle({ guide }: { guide: ContentDetail }) {
  const { takeaways, rest } = guide.showKeyTakeaways !== false ? extractKeyTakeaways(guide.body ?? '') : { takeaways: null, rest: guide.body ?? '' };
  const headings = guide.showToc !== false ? markdownHeadings(rest) : [];
  return (
    <>
      <section className={s.articleHero}>
        <div className={s.container}>
          <nav className={s.crumbs} aria-label="Breadcrumb">
            <Link href="/blog">Resources</Link> / <Link href="/guides">Guides</Link>
          </nav>
          <h1 className={s.h1} style={{ maxWidth: 900 }}>
            {guide.title}
          </h1>
          {guide.excerpt && <p className={s.lead}>{guide.excerpt}</p>}
          <div className={s.byline}>
            <span className={s.avatar} aria-hidden>
              {(guide.author?.displayName ?? 'A').slice(0, 1)}
            </span>
            <div>
              <b>By {guide.author?.displayName ?? 'AmpliVerify Team'}</b>
              <small style={{ display: 'block', color: 'var(--mute)' }}>
                {formatDate(guide.publishedAt)}
                {guide.readingMinutes ? ` · ${guide.readingMinutes} min read` : ''} · {guide.category?.name ?? 'Guides'}
              </small>
            </div>
          </div>
        </div>
      </section>
      <div className={s.container}>
        <div className={s.articleGrid} style={{ gridTemplateColumns: headings.length ? undefined : 'minmax(0, 1fr)' }}>
          {headings.length > 0 && <Toc headings={headings} />}
          <article>
            <Cover imageUrl={guide.imageUrl} alt={guide.title} dark badge="Guide" className={s.detailCover} />
            {takeaways && (
              <KeyTakeaway>
                <b>Key takeaways:</b> <Markdown source={takeaways} className={s.inlineProse} />
              </KeyTakeaway>
            )}
            <Markdown source={rest} />
            <CtaBox wide />
            <Comments kind="guides" slug={guide.slug} />
          </article>
        </div>
        {guide.related && guide.related.length > 0 && (
          <section style={{ paddingBottom: 72 }}>
            <h2 className={s.h2} style={{ fontSize: 'clamp(24px, 6vw, 30px)' }}>
              Related Articles
            </h2>
            <div className={s.posts}>
              {guide.related.map((r, i) => (
                <ArticleCard key={r.slug} item={r} href={`/guides/${r.slug}`} showAuthor={false} dark={i === 1} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
