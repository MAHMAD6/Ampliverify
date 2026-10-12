import Link from 'next/link';
import { ArrowRight, Lightbulb, Mail } from 'lucide-react';
import { TrendArt } from './Blocks';
import { CopyLink, NewsletterForm } from './Engage';
import { webMediaUrl } from '@/lib/media';
import { formatDate, initials } from '@/lib/format';
import type { ContentAuthor, ContentSummary } from '@/lib/types';
import s from './site.module.css';

/** Featured image, or the brand trend illustration when none is set. */
export function Cover({ imageUrl, alt, dark = false, badge, className }: { imageUrl?: string | null; alt: string; dark?: boolean; badge?: string; className?: string }) {
  return (
    <div className={`${s.cover} ${className ?? ''}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={webMediaUrl(imageUrl)} alt={alt} className={s.coverImg} loading="lazy" />
      ) : (
        <TrendArt dark={dark} />
      )}
      {badge && <span className={s.tagOn}>{badge}</span>}
    </div>
  );
}

export function Avatar({ author, size = 40 }: { author?: ContentAuthor | null; size?: number }) {
  if (author?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={webMediaUrl(author.avatarUrl)} alt="" width={size} height={size} className={s.avatarImg} style={{ width: size, height: size }} />;
  }
  return (
    <span className={s.avatar} style={{ width: size, height: size }} aria-hidden>
      {initials(author?.displayName ?? 'AmpliVerify', undefined).slice(0, 1)}
    </span>
  );
}

export function Byline({ item, size = 40 }: { item: ContentSummary; size?: number }) {
  return (
    <div className={s.byline}>
      <Avatar author={item.author} size={size} />
      <div>
        <b>By {item.author?.displayName ?? 'AmpliVerify Team'}</b>
        <small style={{ display: 'block', color: 'var(--mute)' }}>
          {formatDate(item.publishedAt)}
          {item.readingMinutes ? ` · ${item.readingMinutes} min read` : ''}
        </small>
      </div>
    </div>
  );
}

/** Grid card used on Blog, Guides and related lists. */
export function ArticleCard({ item, href, showAuthor = true, dark = false }: { item: ContentSummary; href: string; showAuthor?: boolean; dark?: boolean }) {
  return (
    <Link href={href} className={s.post}>
      <Cover imageUrl={item.imageUrl} alt="" dark={dark} badge={showAuthor ? undefined : item.category?.name} />
      <div className={s.postBody}>
        {showAuthor && item.category && <span className={s.chipSm}>{item.category.name}</span>}
        {!showAuthor && item.readingMinutes && <small>{item.readingMinutes} min read</small>}
        <h3>{item.title}</h3>
        {item.excerpt && <p>{item.excerpt}</p>}
        <div className={s.cardFoot}>
          {showAuthor ? <Byline item={item} size={34} /> : <span />}
          <span className={s.roundArrow} aria-hidden>
            <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Splits a "## Key takeaways" section out of the body so it can be shown as a highlight. */
export function extractKeyTakeaways(body: string) {
  const m = /^##\s+key takeaways?\s*$/im.exec(body);
  if (!m) return { takeaways: null as string | null, rest: body };
  const start = m.index;
  const after = body.slice(start + m[0].length);
  const next = after.search(/^##\s+/m);
  const section = (next === -1 ? after : after.slice(0, next)).trim();
  // Only the first block (a list or paragraph) is the highlight; anything after it stays in the article.
  const [first, ...others] = section.split(/\n\s*\n(?![ \t]*(?:[-*+]|\d+\.)\s)/);
  const leftover = others.join('\n\n').trim();
  return { takeaways: first?.trim() || null, rest: body.slice(0, start) + (leftover ? `${leftover}\n\n` : '') + (next === -1 ? '' : after.slice(next)) };
}

export function KeyTakeaway({ children }: { children: React.ReactNode }) {
  return (
    <aside className={s.takeaway}>
      <span className={s.takeawayIcon} aria-hidden>
        <Lightbulb size={18} />
      </span>
      <div>{children}</div>
    </aside>
  );
}

export function Toc({ headings, numbered = false, title = 'In This Article' }: { headings: { id: string; text: string }[]; numbered?: boolean; title?: string }) {
  if (!headings.length) return null;
  return (
    <nav className={numbered ? s.tocCard : s.toc} aria-label={title}>
      <b>{title}</b>
      {numbered ? (
        <ol>
          {headings.map((h) => (
            <li key={h.id}>
              <a href={`#${h.id}`}>{h.text}</a>
            </li>
          ))}
        </ol>
      ) : (
        headings.map((h) => (
          <a key={h.id} href={`#${h.id}`}>
            {h.text}
          </a>
        ))
      )}
    </nav>
  );
}

const SHARE = {
  linkedin: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
  x: (u: string, t: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  facebook: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
};
const GLYPH = {
  linkedin: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.5h.06c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.77 2.55 4.77 5.87v5.58h-4v-4.95c0-1.18-.02-2.7-1.7-2.7-1.7 0-1.96 1.28-1.96 2.61v5.04h-4v-11Z',
  x: 'M17.6 3h3.2l-7 8 8.2 10.9h-6.4l-5-6.6-5.8 6.6H1.6l7.5-8.6L1.2 3h6.6l4.5 6 5.3-6Zm-1.1 17h1.8L7.6 4.8H5.7L16.5 20Z',
  facebook: 'M14 8.5V6.6c0-.9.6-1.1 1-1.1h2.6V1.6L14 1.6c-4 0-4.9 3-4.9 4.9v2H6.7v4h2.4V22H14v-9.5h3.3l.4-4H14Z',
};

export function ShareRow({ url, title }: { url: string; title: string }) {
  return (
    <div className={s.shareRow}>
      {(['linkedin', 'x', 'facebook'] as const).map((k) => (
        <a key={k} className={s.shareBtn} href={SHARE[k](url, title)} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${k === 'x' ? 'X' : k[0].toUpperCase() + k.slice(1)}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
            <path d={GLYPH[k]} />
          </svg>
        </a>
      ))}
      <CopyLink url={url} />
    </div>
  );
}

/** Wide newsletter band (Blog and Guides landing pages). */
export function NewsletterBand({ eyebrow, title, text, source }: { eyebrow?: string; title: string; text: string; source: string }) {
  return (
    <section style={{ paddingBottom: 72 }}>
      <div className={s.container}>
        <div className={s.newsBand}>
          <span className={s.newsIcon} aria-hidden>
            <Mail size={30} />
          </span>
          <div>
            {eyebrow && <small className={s.eyebrow} style={{ fontSize: 12 }}>{eyebrow}</small>}
            <h2 className={s.h2} style={{ fontSize: 'clamp(24px, 6vw, 30px)', margin: '4px 0' }}>
              {title}
            </h2>
            <p style={{ color: 'var(--ink2)' }}>{text}</p>
          </div>
          <div>
            <NewsletterForm source={source} />
            <small style={{ color: 'var(--mute)' }}>No spam. Unsubscribe anytime.</small>
          </div>
        </div>
      </div>
    </section>
  );
}
