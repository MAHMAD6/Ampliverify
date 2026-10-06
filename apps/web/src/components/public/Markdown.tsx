import ReactMarkdown from 'react-markdown';
import { slugifyHeading } from '@/lib/format';
import s from './public.module.css';

/** Renders CMS markdown. Raw HTML is not rendered (react-markdown default). */
export function Markdown({ source }: { source: string }) {
  return (
    <div className={s.prose}>
      <ReactMarkdown
        components={{
          h2: ({ children }) => <h2 id={slugifyHeading(String(children))}>{children}</h2>,
          a: ({ href, children }) => (
            <a href={href} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
