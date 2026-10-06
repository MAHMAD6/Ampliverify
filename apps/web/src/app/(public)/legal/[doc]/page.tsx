import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyContent } from '@/components/public/ContentList';
import { Hero } from '@/components/public/Hero';
import s from '@/components/public/public.module.css';

const DOCS: Record<string, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  cookies: 'Cookie Policy',
};

type Props = { params: Promise<{ doc: string }> };

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const title = DOCS[(await params).doc];
  return title ? { title } : {};
}

/** Legal text must come from the approved policy source; nothing is drafted here. */
export default async function LegalPage({ params }: Props) {
  const title = DOCS[(await params).doc];
  if (!title) notFound();
  return (
    <>
      <Hero eyebrow="Legal" title={title} />
      <section className={s.section}>
        <div className={s.container}>
          <EmptyContent title={`The ${title} will be published here`} text="Please check back soon, or contact us if you need this information now." />
        </div>
      </section>
    </>
  );
}
