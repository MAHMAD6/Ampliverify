import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { getPlatformInfo } from '@/lib/platform';
import { Brand } from './Brand';
import { FooterNav } from './FooterNav';
import s from './site.module.css';

const COLUMNS = [
  { title: 'Product', links: [['Features', '/features'], ['Pricing', '/pricing'], ['How It Works', '/how-it-works']] },
  { title: 'Resources', links: [['Blog', '/blog'], ['Guides', '/guides'], ['Help Center', '/help'], ['Website Value Calculator', '/website-value']] },
  { title: 'Company', links: [['About Us', '/about'], ['Careers', '/careers'], ['Contact', '/contact']] },
  { title: 'Legal', links: [['Privacy Policy', '/legal'], ['Terms of Service', '/legal?doc=terms'], ['Cookie Policy', '/legal?doc=cookies'], ['DPA', '/legal?doc=dpa']] },
] as const;

/** Brand glyphs drawn inline (lucide has no brand icons). */
const ICONS = {
  linkedin: (
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.5h.06c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.77 2.55 4.77 5.87v5.58h-4v-4.95c0-1.18-.02-2.7-1.7-2.7-1.7 0-1.96 1.28-1.96 2.61v5.04h-4v-11Z" />
  ),
  x: <path d="M17.6 3h3.2l-7 8 8.2 10.9h-6.4l-5-6.6-5.8 6.6H1.6l7.5-8.6L1.2 3h6.6l4.5 6 5.3-6Zm-1.1 17h1.8L7.6 4.8H5.7L16.5 20Z" />,
  youtube: <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12c0 1.6.2 3.2.5 4.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.3-1.6.5-3.2.5-4.8s-.2-3.2-.5-4.8ZM9.8 15.1V8.9l5.8 3.1-5.8 3.1Z" />,
  instagram: (
    <path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21.9 8.2c-.1-1.6-.4-3-1.6-4.2S17.4 2.4 15.8 2.3C14.1 2.2 9.9 2.2 8.2 2.3 6.6 2.4 5.2 2.8 4 3.9S2.4 6.6 2.3 8.2c-.1 1.7-.1 5.9 0 7.6.1 1.6.4 3 1.6 4.2s2.6 1.5 4.2 1.6c1.7.1 5.9.1 7.6 0 1.6-.1 3-.4 4.2-1.6s1.5-2.6 1.6-4.2c.1-1.7.1-5.9 0-7.6Zm-2.2 9.5a3.1 3.1 0 0 1-1.7 1.7c-1.2.5-4 .4-5.3.4s-4.1.1-5.3-.4a3.1 3.1 0 0 1-1.7-1.7c-.5-1.2-.4-4-.4-5.3s-.1-4.1.4-5.3A3.1 3.1 0 0 1 6.7 5.4c1.2-.5 4-.4 5.3-.4s4.1-.1 5.3.4a3.1 3.1 0 0 1 1.7 1.7c.5 1.2.4 4 .4 5.3s.1 4.1-.4 5.3Z" />
  ),
} as const;
const LABELS = { linkedin: 'LinkedIn', x: 'X (Twitter)', youtube: 'YouTube', instagram: 'Instagram' } as const;

/** Public footer. Social icons appear only for profile URLs set in Super Admin → Settings. */
export async function SiteFooter() {
  const platform = await getPlatformInfo();
  const social = (Object.keys(ICONS) as (keyof typeof ICONS)[]).map((k) => [k, platform.social?.[k] ?? null] as const).filter(([, url]) => !!url);
  return (
    <footer className={s.footer}>
      <div className={`${s.container} ${s.footerGrid}`}>
        <div>
          <Brand dark />
          <p className={s.footerAbout}>AmpliVerify helps businesses improve search visibility through a structured, engineering-led approach to SEO.</p>
          {social.length > 0 && (
            <div className={s.social}>
              {social.map(([k, url]) => (
                <a key={k} href={url!} target="_blank" rel="noopener noreferrer" aria-label={LABELS[k]}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                    {ICONS[k]}
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
        {COLUMNS.map((c) => (
          <Suspense
            key={c.title}
            fallback={
              <nav aria-label={c.title}>
                <h4>{c.title}</h4>
                {c.links.map(([l, h]) => (
                  <Link key={h} href={h}>
                    {l}
                  </Link>
                ))}
              </nav>
            }
          >
            <FooterNav title={c.title} links={c.links} />
          </Suspense>
        ))}
        <div>
          <Link href="/signup" className={`${s.btn} ${s.footerCta}`}>
            Get Started Free <ArrowRight size={18} />
          </Link>
        </div>
      </div>
      <div className={`${s.container} ${s.copy}`}>
        <span>© {new Date().getFullYear()} AmpliVerify. All rights reserved.</span>
        <span className={s.motto}>Audit · Optimize · Verify</span>
      </div>
    </footer>
  );
}
