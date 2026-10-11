import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Info } from 'lucide-react';
import { slugifyHeading } from '@/lib/format';
import { videoEmbed, webMediaUrl } from '@/lib/media';
import s from './site.module.css';

const text = (children: React.ReactNode): string =>
  Array.isArray(children) ? children.map(text).join('') : typeof children === 'string' || typeof children === 'number' ? String(children) : children && typeof children === 'object' && 'props' in children ? text((children as { props: { children?: React.ReactNode } }).props.children) : '';

/**
 * Renders CMS markdown (GitHub-flavoured: tables, task lists). Raw HTML is
 * not rendered. Blockquotes render as callouts; images whose alt text starts
 * with "video:" render as embedded videos (YouTube, Vimeo or a Media Library
 * upload).
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={className ?? s.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <h2 id={slugifyHeading(text(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slugifyHeading(text(children))}>{children}</h3>,
          a: ({ href, children }) => (
            <a href={href} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <aside className={s.callout}>
              <span className={s.calloutIcon} aria-hidden>
                <Info size={18} />
              </span>
              <div>{children}</div>
            </aside>
          ),
          table: ({ children }) => (
            <div className={s.tableWrap}>
              <table>{children}</table>
            </div>
          ),
          img: ({ src, alt }) => {
            const url = typeof src === 'string' ? src : '';
            if (alt?.toLowerCase().startsWith('video:')) {
              const title = alt.slice(6).trim() || 'Video';
              const v = videoEmbed(url);
              if (!v) return <a href={url}>{title}</a>;
              return (
                <figure className={s.video}>
                  {v.kind === 'iframe' ? (
                    <iframe src={v.src} title={title} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                  ) : (
                    <video src={v.src} controls preload="metadata" aria-label={title} />
                  )}
                  {alt.slice(6).trim() && <figcaption>{title}</figcaption>}
                </figure>
              );
            }
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={webMediaUrl(url)} alt={alt ?? ''} loading="lazy" />;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
