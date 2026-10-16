import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Cookie, Database, FileText, Globe, HelpCircle, MessageSquare, Settings, ShieldCheck, User, Users } from 'lucide-react';
import { ArtHero } from '@/components/public/HeroArt';
import site from '@/components/public/site.module.css';
import s from '@/components/public/pages.module.css';

type Clause = { title: string; icon: ReactNode; body?: ReactNode };
type Doc = { key: string; nav: string; title: string; lead: string; updated?: string; clauses: Clause[] };

const PRIVACY: Doc = {
  key: 'privacy',
  nav: 'Privacy Policy',
  title: 'Privacy Policy',
  lead: 'This policy explains what information AmpliVerify collects, how we use it, and the choices you have.',
  updated: 'September 27, 2026',
  clauses: [
    {
      title: 'Information We Collect',
      icon: <User size={24} />,
      body: (
        <>
          <p>We collect information you provide directly to us, information we obtain when you use AmpliVerify, and information from connected third-party services.</p>
          <ul>
            <li>
              <b>Account information</b> – name, email address, password, and organization details
            </li>
            <li>
              <b>Website and project data</b> – site content, technical SEO data, analytics data, and related information
            </li>
            <li>
              <b>Usage data</b> – features used, settings, preferences, search queries, and interactions
            </li>
            <li>
              <b>Payment information</b> – processed by our payment provider (we do not store full card details)
            </li>
            <li>
              <b>Communications</b> – messages you send to our support team
            </li>
          </ul>
        </>
      ),
    },
    {
      title: 'How We Use Information',
      icon: <Settings size={24} />,
      body: (
        <>
          <p>We use the information we collect to provide, operate, and improve AmpliVerify, including:</p>
          <ul>
            <li>Delivering and maintaining the service</li>
            <li>Generating SEO audits, insights, and recommendations</li>
            <li>Improving our algorithms, features, and user experience</li>
            <li>Providing customer support</li>
            <li>Managing billing, subscriptions, and account administration</li>
            <li>Communicating important updates, security alerts, and service-related information</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Sharing and Processors',
      icon: <Users size={24} />,
      body: <p>We do not sell your personal information. We share information only as described in this policy, including with trusted service providers who help us operate AmpliVerify (e.g., cloud hosting, analytics, email, payment processing) and when required by law.</p>,
    },
    {
      title: 'Data Retention and Deletion',
      icon: <Database size={24} />,
      body: <p>We keep your information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. You can request deletion of your account and associated data at any time, subject to certain legal and operational requirements.</p>,
    },
    {
      title: 'Your Rights',
      icon: <ShieldCheck size={24} />,
      body: <p>Depending on your location, you may have rights to access, correct, delete, restrict or object to the processing of your personal information. You can manage your account settings or contact us to exercise these rights.</p>,
    },
    {
      title: 'International Transfers',
      icon: <Globe size={24} />,
      body: <p>Your information may be processed and stored in countries other than your own. We use appropriate safeguards (such as Standard Contractual Clauses where applicable) to protect your information.</p>,
    },
  ],
};

/** Documents whose approved text has not been published yet show their outline with a notice. */
const pendingDoc = (key: string, nav: string, title: string, lead: string, clauses: [string, ReactNode][]): Doc => ({ key, nav, title, lead, clauses: clauses.map(([t, icon]) => ({ title: t, icon })) });

const DOCS: Doc[] = [
  PRIVACY,
  pendingDoc('terms', 'Terms of Service', 'Terms of Service', 'These terms govern your use of AmpliVerify and its related services.', [
    ['Accounts', <User key="a" size={24} />],
    ['Plans, Billing and Cancellation', <FileText key="b" size={24} />],
    ['Acceptable Use', <ShieldCheck key="c" size={24} />],
    ['Liability and Warranties', <Settings key="d" size={24} />],
    ['Changes and Governing Law', <Globe key="e" size={24} />],
  ]),
  pendingDoc('cookies', 'Cookie Policy', 'Cookie Policy', 'This policy describes the cookies and similar technologies used on our website and product.', [
    ['Types of Cookies We Use', <Cookie key="a" size={24} />],
    ['Managing Your Preferences', <Settings key="b" size={24} />],
  ]),
  pendingDoc('dpa', 'Data Processing Agreement (DPA)', 'Data Processing Agreement', 'How AmpliVerify processes personal data on behalf of customers.', [
    ['Scope and Roles', <Users key="a" size={24} />],
    ['Sub-processors', <Database key="b" size={24} />],
    ['Security Measures', <ShieldCheck key="c" size={24} />],
    ['International Transfers', <Globe key="d" size={24} />],
  ]),
  pendingDoc('regional', 'Regional Disclosures', 'Regional Disclosures', 'Region-specific information, including GDPR, CCPA, and other applicable privacy laws.', [
    ['European Economic Area and UK (GDPR)', <Globe key="a" size={24} />],
    ['California (CCPA / CPRA)', <ShieldCheck key="b" size={24} />],
  ]),
];

const NAV_ICON: Record<string, ReactNode> = {
  privacy: <FileText size={20} />,
  terms: <FileText size={20} />,
  cookies: <Cookie size={20} />,
  dpa: <ShieldCheck size={20} />,
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ doc?: string }> }): Promise<Metadata> {
  const { doc } = await searchParams;
  return { title: DOCS.find((d) => d.key === doc)?.title ?? 'Privacy Policy' };
}

/** Legal (Public_Frontend "Privacy Policy Page"): left document nav, numbered collapsible clauses, regional disclosures. */
export default async function LegalPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc: key } = await searchParams;
  const doc = DOCS.find((d) => d.key === key) ?? PRIVACY;
  return (
    <>
      <ArtHero art="legal" eyebrow="Legal" title={doc.title} lead={doc.lead}>
        {doc.updated && <p style={{ marginTop: 14, fontWeight: 700, fontSize: 15 }}>Last updated: {doc.updated}</p>}
      </ArtHero>
      <section className={s.section} style={{ paddingTop: 24 }}>
        <div className={`${s.wrap} ${s.legalGrid}`}>
          <aside className={s.legalSide}>
            <nav className={s.legalNav} aria-label="Legal documents">
              {DOCS.filter((d) => d.key !== 'regional').map((d) => (
                <Link key={d.key} href={d.key === 'privacy' ? '/legal' : `/legal?doc=${d.key}`} aria-current={d.key === doc.key ? 'page' : undefined}>
                  {NAV_ICON[d.key]}
                  <span>{d.nav}</span>
                  <ChevronRight size={18} />
                </Link>
              ))}
              <Link href="/contact?topic=privacy">
                <HelpCircle size={20} />
                <span>Questions? Contact us</span>
                <ChevronRight size={18} />
              </Link>
            </nav>
            <div className={s.askCard}>
              <span className={s.circle} style={{ background: '#fff' }}>
                <MessageSquare size={24} />
              </span>
              <h3>Questions about our policies?</h3>
              <p>If you have any questions, please contact our team.</p>
              <Link href="/contact?topic=privacy" className={site.btn} style={{ width: '100%' }}>
                Contact Us <ArrowRight size={18} />
              </Link>
            </div>
          </aside>
          <div>
            <div className={s.policy}>
              {doc.clauses.map((c, i) => (
                <div key={c.title} className={s.clause}>
                  <span className={s.circle}>{c.icon}</span>
                  <details open>
                    <summary>
                      {i + 1}. {c.title}
                      <ChevronDown size={20} />
                    </summary>
                    <div className={s.body}>{c.body ?? <div className={s.pending}>This section will be published once the approved text is available.</div>}</div>
                  </details>
                </div>
              ))}
            </div>
            {doc.key !== 'regional' && (
              <div className={s.disclosures}>
                <span className={s.circle} style={{ width: 64, height: 64, background: '#fff' }}>
                  <FileText size={28} />
                </span>
                <div className={s.grow}>
                  <h3>View Regional Disclosures</h3>
                  <p>Learn more about region-specific information, including GDPR, CCPA, and other applicable privacy laws.</p>
                </div>
                <Link href="/legal?doc=regional" className={site.btn}>
                  View Disclosures <ArrowRight size={18} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
