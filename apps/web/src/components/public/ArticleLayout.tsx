import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { markdownHeadings } from '@/lib/format';
import { TrendArt } from './Blocks';
import { Markdown } from './Markdown';
import s from './site.module.css';

export type Related = { href: string; title: string; category?: string | null };

/** Article / guide / help detail (public-website-v2/06-Article): hero, sticky contents, markdown body, CTA, related. */
export function ArticleLayout({
  category,
  title,
  summary,
  meta,
  author,
  body,
  tocTitle = 'In this article',
  breadcrumb,
  footer,
  related = [],
  cover = true,
  emptyBody = 'The full content for this page is not available right now.',
}: {
  category: string;
  title: string;
  summary?: string | null;
  meta?: ReactNode;
  author?: string | null;
  body: string | null;
  tocTitle?: string;
  breadcrumb?: { label: string; href?: string }[];
  align?: 'center' | 'left';
  footer?: ReactNode;
  related?: Related[];
  cover?: boolean;
  emptyBody?: string;
}) {
  const headings = markdownHeadings(body);
  return (
    <article>
      <header className={s.articleHero}>
        <div className={s.container}>
          {breadcrumb && (
            <nav className={s.crumbs} aria-label="Breadcrumb">
              {breadcrumb.slice(0, -1).map((b, i) => (
                <span key={b.label}>
                  {b.href ? <Link href={b.href}>{b.label}</Link> : b.label}
                  {i < breadcrumb.length - 2 && ' / '}
                </span>
              ))}
              {breadcrumb.length > 1 && <span>/ {category}</span>}
            </nav>
          )}
          <h1 className={s.h1} style={{ fontSize: 'clamp(32px, 4.4vw, 52px)', maxWidth: 900 }}>
            {title}
          </h1>
          {summary && <p className={s.lead}>{summary}</p>}
          {(author || meta) && (
            <div className={s.byline}>
              {author && <span className={s.avatar}>{author.charAt(0).toUpperCase()}</span>}
              <span>
                {author && <b style={{ display: 'block' }}>{author}</b>}
                <small style={{ color: 'var(--mute)' }}>{meta}</small>
              </span>
            </div>
          )}
        </div>
      </header>
      <div className={`${s.container} ${s.articleGrid}`} style={headings.length < 2 ? { gridTemplateColumns: 'minmax(0, 760px)', justifyContent: 'center' } : undefined}>
        {headings.length >= 2 && (
          <aside className={s.toc}>
            <b>{tocTitle}</b>
            {headings.map((h) => (
              <a key={h.id} href={`#${h.id}`}>
                {h.text}
              </a>
            ))}
          </aside>
        )}
        <div>
          {cover && (
            <div className={s.cover} style={{ height: 240, borderRadius: 16, overflow: 'hidden', background: 'var(--g900)', marginBottom: 28 }}>
              <TrendArt dark />
            </div>
          )}
          {body ? <Markdown source={body} className={s.prose} /> : <p className={s.prose}>{emptyBody}</p>}
          {footer}
          <div className={s.articleCta}>
            <div>
              <b style={{ fontSize: 19 }}>Prioritize Your Own Fixes Automatically</b>
              <p className={s.cardText}>Run a free audit and get a ranked plan for your site.</p>
            </div>
            <Link href="/signup" className={`${s.btn} ${s.sm}`}>
              Get Started Free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section style={{ paddingBottom: 72 }}>
          <div className={s.container}>
            <h2 className={s.h2} style={{ fontSize: 28 }}>
              Related Articles
            </h2>
            <div className={s.posts} style={{ marginTop: 18 }}>
              {related.slice(0, 3).map((r, i) => (
                <Link key={r.href} href={r.href} className={s.post}>
                  <div className={s.cover} style={{ height: 100 }}>
                    <TrendArt dark={i === 1} />
                  </div>
                  <div className={s.postBody}>
                    {r.category && <small style={{ color: 'var(--g900)' }}>{r.category}</small>}
                    <h3>{r.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
