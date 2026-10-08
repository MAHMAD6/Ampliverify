import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import s from '@/components/public/site.module.css';

export const metadata = { title: 'Application Submitted', robots: { index: false } };

type Receipt = { reference: string | null; jobTitle: string };

/**
 * Application Success (public-careers-application/02). Shown only for a
 * receipt the backend confirms (otherwise 404). Makes no promise about
 * interviews or response times.
 */
export default async function ApplicationSuccessPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ receipt?: string }> }) {
  const [{ slug }, { receipt }] = await Promise.all([params, searchParams]);
  if (!receipt) notFound();
  const result = await apiGet<Receipt>(`/public/careers/${encodeURIComponent(slug)}/applications/${encodeURIComponent(receipt)}`);
  if (!result.ok) notFound();
  return (
    <section className={s.section}>
      <div className={`${s.container} ${s.center}`} style={{ maxWidth: 640 }}>
        <CheckCircle2 size={64} color="var(--g900)" style={{ margin: '0 auto' }} />
        <div className={s.eyebrow} style={{ marginTop: 16 }}>
          Application Submitted
        </div>
        <h1 className={s.h1}>Thank you for applying</h1>
        <p className={s.lead} style={{ margin: '0 auto' }}>
          Your application for {result.data.jobTitle} has been received by AmpliVerify.
        </p>
        {result.data.reference && <p className={s.cardText}>Reference: {result.data.reference}</p>}
        <div className={s.heroActions} style={{ justifyContent: 'center' }}>
          <Link href="/careers" className={s.btn}>
            View Careers
          </Link>
          <Link href="/" className={s.btnOutline}>
            Return to Homepage
          </Link>
        </div>
      </div>
    </section>
  );
}
