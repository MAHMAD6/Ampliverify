import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Brand } from './Brand';
import s from './site.module.css';

const COLUMNS = [
  { title: 'Product', links: [['Features', '/features'], ['Pricing', '/pricing'], ['How It Works', '/how-it-works']] },
  { title: 'Resources', links: [['Blog', '/blog'], ['Guides', '/guides'], ['Help Center', '/help'], ['Case Studies', '/case-studies'], ['Webinars & Videos', '/webinars']] },
  { title: 'Company', links: [['About Us', '/about'], ['Careers', '/careers'], ['Contact', '/contact']] },
  { title: 'Legal', links: [['Privacy Policy', '/legal#privacy'], ['Terms of Service', '/legal#terms'], ['Cookie Policy', '/legal#cookies']] },
] as const;

/** Public footer (public-website-v2). Social profiles are not linked until real profile URLs exist. */
export function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={`${s.container} ${s.footerGrid}`}>
        <div>
          <Brand />
          <p className={s.footerAbout}>AmpliVerify helps businesses improve search visibility through a structured, engineering-led approach to SEO.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h4>{c.title}</h4>
            {c.links.map(([l, h]) => (
              <Link key={h} href={h}>
                {l}
              </Link>
            ))}
          </nav>
        ))}
        <div>
          <Link href="/signup" className={`${s.btn} ${s.footerCta}`}>
            Get Started Free <ArrowRight size={18} />
          </Link>
        </div>
      </div>
      <p className={`${s.container} ${s.copy}`}>© {new Date().getFullYear()} AmpliVerify. All rights reserved.</p>
    </footer>
  );
}
