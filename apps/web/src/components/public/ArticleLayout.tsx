import Link from 'next/link';
import type { ReactNode } from 'react';
import { markdownHeadings } from '@/lib/format';
import { Markdown } from './Markdown';
import s from './public.module.css';

/** Article / guide / help detail: header, sticky table of contents, markdown body. */
export function ArticleLayout({
  category,
  title,
  summary,
  meta,
  body,
  tocTitle = 'In this article',
  breadcrumb,
  align = 'center',
  footer,
  emptyBody = 'The full content for this page is not available right now.',
}: {
  category: string;
  title: string;
  summary?: string | null;
  meta?: ReactNode;
  body: string | null;
  tocTitle?: string;
  breadcrumb?: { label: string; href?: string }[];
  align?: 'center' | 'left';
  footer?: ReactNode;
  emptyBody?: string;
}) {
  const headings = markdownHeadings(body);
  return (
    <article className={s.articlewrap}>
      {breadcrumb && (
        <nav className={s.breadcrumb} aria-label="Breadcrumb">
          {breadcrumb.map((b, i) => (
            <span key={b.label}>
              {b.href ? <Link href={b.href}>{b.label}</Link> : b.label}
              {i < breadcrumb.length - 1 && ' › '}
            </span>
          ))}
        </nav>
      )}
      <header className={`${s.articlehead} ${align === 'left' ? s.left : ''}`}>
        <div className={s.category}>{category}</div>
        <h1>{title}</h1>
        {summary && <p>{summary}</p>}
        {meta && <div className={s.articlemeta}>{meta}</div>}
      </header>
      <div className={`${s.articlebody} ${headings.length < 2 ? s.single : ''}`}>
        {headings.length >= 2 && (
          <aside className={s.toc}>
            <h3>{tocTitle}</h3>
            {headings.map((h) => (
              <a key={h.id} href={`#${h.id}`}>
                {h.text}
              </a>
            ))}
          </aside>
        )}
        <div>
          {body ? <Markdown source={body} /> : <p className={s.prose}>{emptyBody}</p>}
          {footer}
        </div>
      </div>
    </article>
  );
}
