import type { Metadata } from 'next';
import Link from 'next/link';
import { Briefcase, CircleDollarSign, CircleHelp } from 'lucide-react';
import { Hero, NumberedList } from '@/components/public/Hero';
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import s from '@/components/public/public.module.css';

export const metadata: Metadata = { title: 'Contact' };

/**
 * The message form is rendered but cannot be submitted until contact-message
 * storage exists (not in the database guide; tracked in docs/SCREENS.md).
 * No phone numbers, addresses or response-time promises are shown.
 */
export default function ContactPage() {
  return (
    <>
      <Hero eyebrow="Contact" title="How can we help?">
        Use the form below for product, billing, partnership, or general questions. Signed-in customers can also reach us from Help &amp; Support.
      </Hero>
      <section className={s.section}>
        <div className={s.contactgrid}>
          <div className={s.contactcard}>
            <h3>Contact AmpliVerify</h3>
            <p>Select the topic that best matches your question so it can be routed appropriately.</p>
            <NumberedList
              items={[
                { mark: <CircleHelp size={16} />, title: 'Product questions', text: 'Questions about features, workflows, or product availability.' },
                { mark: <CircleDollarSign size={16} />, title: 'Billing questions', text: 'Questions about plans, subscription, invoices, or credits.' },
                { mark: <Briefcase size={16} />, title: 'Business inquiries', text: 'Partnership, media, or other non-support requests.' },
              ]}
            />
          </div>
          <form className={s.contactcard} aria-describedby="contact-status">
            <h3>Send a message</h3>
            <p>Complete the form and your request will be routed based on the selected topic.</p>
            <Field label="Name" htmlFor="c-name">
              <Input id="c-name" name="name" placeholder="Enter your name" autoComplete="name" required />
            </Field>
            <Field label="Email" htmlFor="c-email">
              <Input id="c-email" name="email" type="email" placeholder="Enter your email" autoComplete="email" required />
            </Field>
            <Field label="Topic" htmlFor="c-topic">
              <Select id="c-topic" name="topic" defaultValue="" required>
                <option value="" disabled>
                  Select a topic
                </option>
                <option value="product">Product question</option>
                <option value="billing">Billing question</option>
                <option value="business">Business inquiry</option>
              </Select>
            </Field>
            <Field label="Subject" htmlFor="c-subject">
              <Input id="c-subject" name="subject" placeholder="Enter a subject" required />
            </Field>
            <Field label="Message" htmlFor="c-message">
              <Textarea id="c-message" name="message" placeholder="Tell us how we can help." required />
            </Field>
            <Button type="submit" variant="green" block disabled>
              Send Message
            </Button>
            <div id="contact-status" style={{ marginTop: 12 }}>
              <Notice tone="green">
                Online messages are not open yet. Existing customers can use <Link href="/app/help">Help &amp; Support</Link>.
              </Notice>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
