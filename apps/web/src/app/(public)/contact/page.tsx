import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, ExternalLink, HelpCircle, Mail, ShieldCheck, Users } from 'lucide-react';
import { ContactForm } from '@/components/public/ContactForm';
import { CONTACT_TOPICS } from '@/components/public/contact-topics';
import { ArtHero } from '@/components/public/HeroArt';
import s from '@/components/public/pages.module.css';

export const metadata: Metadata = { title: 'Contact' };

const EMAIL = 'info@ampliverify.com';

function Mailto() {
  return (
    <a className={s.mail} href={`mailto:${EMAIL}`}>
      <Mail size={18} /> {EMAIL}
    </a>
  );
}

/** Contact (Public_Frontend "Contact Page"). Messages are stored (contact_submissions) and routed to the admin inbox. */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const requested = (await searchParams).topic?.toUpperCase();
  const topic = CONTACT_TOPICS.find(([k]) => k === requested || (requested === 'PARTNERSHIPS' && k === 'PARTNERSHIP'))?.[0] ?? '';
  return (
    <>
      <ArtHero
        art="contact"
        eyebrow="Contact Us"
        title={
          <>
            Start a <em>Conversation</em>
          </>
        }
        lead="Questions about AmpliVerify, pricing, partnerships, or support? Send us a message and we'll route it to the right team."
      />
      <section className={s.section} style={{ paddingTop: 28 }}>
        <div className={`${s.wrap} ${s.contactGrid}`}>
          <ContactForm topic={topic} />
          <div className={s.contactSide} style={{ display: 'grid', gap: 16 }}>
            <div className={`${s.card} ${s.infoCard}`}>
              <span className={s.circle}>
                <BarChart3 size={24} />
              </span>
              <div>
                <h3>Sales &amp; General Inquiries</h3>
                <p>Learn more about AmpliVerify, pricing, or how it can help your business.</p>
                <Mailto />
              </div>
            </div>
            <div className={`${s.card} ${s.infoCard}`}>
              <span className={`${s.circle} ${s.blue}`}>
                <HelpCircle size={24} />
              </span>
              <div>
                <h3>Product Support</h3>
                <p>Get help with your account, features, or technical questions.</p>
                <Link href="/help" className={s.mail}>
                  <ExternalLink size={18} /> Visit Help Center <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className={`${s.card} ${s.infoCard}`}>
              <span className={`${s.circle} ${s.violet}`}>
                <Users size={24} />
              </span>
              <div>
                <h3>Partnerships</h3>
                <p>Interested in partnering with AmpliVerify? Send us a message through the form or email our team.</p>
                <Mailto />
              </div>
            </div>
            <div className={`${s.card} ${s.infoCard}`}>
              <span className={s.circle}>
                <ShieldCheck size={24} />
              </span>
              <div>
                <h3>Privacy &amp; Legal</h3>
                <p>For privacy, legal, or data protection inquiries, please contact:</p>
                <Mailto />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
