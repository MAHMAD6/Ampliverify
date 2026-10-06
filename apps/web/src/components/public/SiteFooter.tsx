import Link from 'next/link';
import { Logo } from '../brand/Logo';
import s from './public.module.css';

const COLUMNS = [
  { title: 'Product', links: [['Features', '/#features'], ['Pricing', '/pricing'], ['How It Works', '/#how-it-works'], ['Integrations', '/integrations']] },
  { title: 'Resources', links: [['Blog', '/blog'], ['Guides', '/guides'], ['Help Center', '/help']] },
  { title: 'Company', links: [['About Us', '/about'], ['Careers', '/careers'], ['Contact', '/contact']] },
  { title: 'Legal', links: [['Privacy Policy', '/legal/privacy'], ['Terms of Service', '/legal/terms'], ['Cookie Policy', '/legal/cookies']] },
] as const;

export function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.footerGrid}>
        <div>
          <Logo onDark tagline="engineering" size={36} />
          <p className={s.footerAbout}>
            AmpliVerify helps businesses improve search visibility through a structured, engineering-led approach to SEO.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className={s.footerCol}>
            <h4>{col.title}</h4>
            {col.links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className={s.footerBar}>
        <span>© {new Date().getFullYear()} AmpliVerify. All rights reserved.</span>
        <nav aria-label="Legal">
          <Link href="/legal/privacy">Privacy Policy</Link>
          <Link href="/legal/terms">Terms of Service</Link>
          <Link href="/legal/cookies">Cookie Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
