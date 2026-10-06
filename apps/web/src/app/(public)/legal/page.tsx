import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/public/Blocks';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Policies & Terms' };

const POLICIES = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    intro: 'This policy explains what information AmpliVerify collects, how we use it, and the choices you have.',
    sections: ['Information We Collect', 'How We Use Information', 'Sharing and Processors', 'Data Retention and Deletion', 'Your Rights'],
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    intro: 'These terms govern your use of AmpliVerify and its related services.',
    sections: ['Accounts', 'Plans, Billing and Cancellation', 'Acceptable Use', 'Liability and Warranties', 'Changes and Governing Law'],
  },
  {
    id: 'cookies',
    title: 'Cookie Policy',
    intro: 'This policy describes the cookies and similar technologies used on our website and product.',
    sections: ['Types of Cookies We Use', 'Managing Your Preferences'],
  },
];

/**
 * Policies & Terms (public-website-v2/11). The structure is from the design;
 * policy text must come from counsel-approved copy, so each section says it
 * is pending rather than showing the design's placeholder notes.
 */
export default function LegalPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Policies & Terms" lead="Approved policy text will be published here." />
      <section className={s.section}>
        <div className={s.container} style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 760px)', gap: 56 }}>
          <nav className={s.legalNav} aria-label="Policies">
            {POLICIES.map((p) => (
              <a key={p.id} href={`#${p.id}`}>
                {p.title}
              </a>
            ))}
            <Link href="/contact">Questions? Contact us</Link>
          </nav>
          <div>
            {POLICIES.map((p) => (
              <section key={p.id} id={p.id} style={{ marginBottom: 48, scrollMarginTop: 100 }}>
                <h2 className={s.h2} style={{ fontSize: 30 }}>
                  {p.title}
                </h2>
                <p className={s.cardText}>{p.intro}</p>
                {p.sections.map((sec, i) => (
                  <div key={sec} style={{ marginTop: 20 }}>
                    <h3 style={{ fontSize: 18, marginBottom: 10 }}>
                      {i + 1}. {sec}
                    </h3>
                    <div className={s.pending}>This section will be published once the approved policy text is available.</div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
