import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Cookie, Database, FileText, Globe, HelpCircle, MessageSquare, Settings, ShieldCheck, User, Users } from 'lucide-react';
import { ArtHero } from '@/components/public/HeroArt';
import { Markdown } from '@/components/public/Markdown';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import site from '@/components/public/site.module.css';
import s from '@/components/public/pages.module.css';

type Clause = { title: string; icon: ReactNode; body?: ReactNode };
export type LegalKey = 'privacy' | 'terms' | 'cookies' | 'dpa' | 'refund' | 'seller' | 'regional';
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

const REFUND: Doc = {
  key: 'refund',
  nav: 'Digital Product Refund Policy',
  title: 'Digital Product Refund Policy',
  lead: 'When digital-product refunds may be considered, how to request support, and how buyer and seller responsibilities are handled.',
  updated: 'November 2026',
  clauses: [
    { title: 'Overview', icon: <FileText size={24} />, body: <p>This policy addresses refund requests for downloadable digital products purchased through the AmpliVerify Marketplace and is read with the applicable Terms, product license, and consumer protections.</p> },
    { title: 'General Refund Principle', icon: <ShieldCheck size={24} />, body: <p>Digital purchases are generally not refundable solely due to a change of mind after access or download, except where applicable law provides otherwise. Eligible problems are reviewed individually.</p> },
    { title: 'Seven-Day Reporting Window', icon: <Settings size={24} />, body: <p>Buyers are encouraged to report product-related problems within seven calendar days of the transaction. This is a reporting guideline, not a waiver or restriction of mandatory legal remedies.</p> },
    { title: 'Eligible Refund Reasons', icon: <Users size={24} />, body: <ul><li>Failed delivery or inaccessible purchased files.</li><li>Materially defective or corrupted files not corrected or replaced.</li><li>Product materially different from its disclosed description.</li><li>Missing advertised components.</li><li>Verified duplicate charge.</li><li>Material intellectual-property or required AI-disclosure violations.</li><li>Other circumstances required by law.</li></ul> },
    { title: 'General Exclusions', icon: <Database size={24} />, body: <p>A change of mind, unsupported expectations, or failure to review clearly disclosed compatibility terms does not by itself establish a refund entitlement, subject always to consumer law.</p> },
    { title: 'Seller Responsibilities', icon: <Globe size={24} />, body: <p>Sellers must accurately describe products, possess relevant distribution rights, disclose required AI involvement, cooperate in investigations, and bear seller-attributable refund responsibility where legally and contractually applicable.</p> },
    { title: 'Refund Review and Routing', icon: <User size={24} />, body: <p>Buyers submit a request with transaction information and evidence from the purchase page. Where appropriate, the seller may correct the issue; approved refunds are generally routed to the original payment method through supported payment processes.</p> },
    { title: 'Earnings, Chargebacks and Payouts', icon: <Cookie size={24} />, body: <p>Eligible seller earnings may be reduced by approved refunds, chargebacks, and disclosed lawful adjustments. Sellers become eligible for payout once eligible earnings reach US $50; timing remains governed by the disclosed payout schedule and payment arrangements.</p> },
    { title: 'Licensing After Refund', icon: <FileText size={24} />, body: <p>Download access may be revoked where permitted; further use of refunded content remains subject to the applicable product license and law.</p> },
    { title: 'International Consumer Rights', icon: <ShieldCheck size={24} />, body: <p>Mandatory cancellation, withdrawal, conformity, refund, and other consumer rights remain unaffected. Jurisdiction-specific digital delivery consent is collected where legally required.</p> },
    { title: 'Contact', icon: <Settings size={24} />, body: <p>Refund questions can be directed to support@ampliverify.com.</p> },
  ],
};

const SELLER: Doc = {
  key: 'seller',
  nav: 'Seller Guidelines',
  title: 'Marketplace Seller Guidelines',
  lead: 'Listing standards, verification, ownership, AI-content disclosure, product licenses, fees and seller responsibilities.',
  updated: 'November 2026',
  clauses: [
    { title: 'Purpose and Scope', icon: <FileText size={24} />, body: <p>These guidelines set requirements for eligible sellers of websites, online businesses, applications, domains, and downloadable digital products, and are read with the Marketplace Terms.</p> },
    { title: 'Account and Eligibility', icon: <ShieldCheck size={24} />, body: <p>Sellers must maintain an accurate account, complete required verification checks, and provide required payment and business details.</p> },
    { title: 'Listing Accuracy', icon: <Settings size={24} />, body: <p>Listings must identify the asset type, actual content, transfer or licensing conditions, material limitations, and truthful claims. Fabricated financial, traffic, revenue, buyer, or review information is prohibited.</p> },
    { title: 'Seller Identity and Ownership', icon: <Users size={24} />, body: <p>Identity review, ownership checks, connected-data verification, and financial-document review are distinct checks. Completion of one does not establish another.</p> },
    { title: 'AI-Generated and AI-Assisted Content', icon: <Database size={24} />, body: <p>Sellers must declare material AI generation or assistance when required and accurately describe related rights or limitations. AI screening may flag content for further review and does not establish authorship conclusively.</p> },
    { title: 'Digital Product Licenses', icon: <Globe size={24} />, body: <p>Every downloadable product must display the applicable license scope and restrictions, including personal/commercial use, modification, redistribution, and access conditions before purchase.</p> },
    { title: 'Upload and Product Review', icon: <User size={24} />, body: <p>Files may be subject to type validation, security scanning, content review, and moderation. Approved products may be published when direct checkout and secure delivery are enabled.</p> },
    { title: 'Buyer Communications', icon: <Cookie size={24} />, body: <p>For ownership-transfer assets, buyers may request an introduction; messaging is enabled only following access approval. Transactions and transfers are governed by the applicable process and agreements.</p> },
    { title: 'Fees, Refunds, and Payouts', icon: <FileText size={24} />, body: <p>All applicable charges and their triggers must be disclosed before commitment. The minimum payout threshold is US $50 in eligible seller earnings, after applicable adjustments. See the Digital Product Refund Policy.</p> },
    { title: 'Enforcement and Support', icon: <ShieldCheck size={24} />, body: <p>Material misrepresentations, prohibited content, intellectual-property violations, and other breaches may lead to review or restrictions under the applicable Marketplace Terms. Contact support@ampliverify.com.</p> },
  ],
};

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
  REFUND,
  SELLER,
  pendingDoc('regional', 'Regional Disclosures', 'Regional Disclosures', 'Region-specific information, including GDPR, CCPA, and other applicable privacy laws.', [
    ['European Economic Area and UK (GDPR)', <Globe key="a" size={24} />],
    ['California (CCPA / CPRA)', <ShieldCheck key="b" size={24} />],
  ]),
];

const NAV_ICON: Record<string, ReactNode> = {
  refund: <FileText size={20} />,
  seller: <Users size={20} />,
  privacy: <FileText size={20} />,
  terms: <FileText size={20} />,
  cookies: <Cookie size={20} />,
  dpa: <ShieldCheck size={20} />,
};

export const DOC_HREF: Record<string, string> = { privacy: '/privacy', terms: '/terms', cookies: '/cookies', dpa: '/dpa', refund: '/digital-product-refund-policy', seller: '/seller-guidelines', regional: '/regional-disclosures' };
export const legalTitle = (k: LegalKey) => DOCS.find((d) => d.key === k)?.title ?? 'Legal';
export const legalLead = (k: LegalKey) => DOCS.find((d) => d.key === k)?.lead;

/** One legal document with the shared legal navigation (V2 guide §4.1 legal routes). */
export async function LegalView({ docKey }: { docKey: LegalKey }) {
  const doc = DOCS.find((d) => d.key === docKey) ?? PRIVACY;
  // Text published in Super Admin > Legal Pages replaces the built-in text.
  const res = await apiGet<{ body: string; version: number; publishedAt: string } | null>(`/public/legal/${doc.key}`, { revalidate: 60 });
  const published = res.ok ? res.data : null;
  return (
    <>
      <ArtHero art="legal" eyebrow="Legal" title={doc.title} lead={doc.lead}>
        {(published || doc.updated) && <p style={{ marginTop: 14, fontWeight: 700, fontSize: 15 }}>Last updated: {published ? `${formatDate(published.publishedAt)} (version ${published.version})` : doc.updated}</p>}
      </ArtHero>
      <section className={s.section} style={{ paddingTop: 24 }}>
        <div className={`${s.wrap} ${s.legalGrid}`}>
          <aside className={s.legalSide}>
            <nav className={s.legalNav} aria-label="Legal documents">
              {DOCS.filter((d) => d.key !== 'regional').map((d) => (
                <Link key={d.key} href={DOC_HREF[d.key]} aria-current={d.key === doc.key ? 'page' : undefined}>
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
            {published ? (
              <div className={s.policy}>
                <Markdown source={published.body} />
              </div>
            ) : (
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
            )}
            {doc.key !== 'regional' && (
              <div className={s.disclosures}>
                <span className={s.circle} style={{ width: 64, height: 64, background: '#fff' }}>
                  <FileText size={28} />
                </span>
                <div className={s.grow}>
                  <h3>View Regional Disclosures</h3>
                  <p>Learn more about region-specific information, including GDPR, CCPA, and other applicable privacy laws.</p>
                </div>
                <Link href="/regional-disclosures" className={site.btn}>
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
