import type { Metadata } from 'next';
import Link from 'next/link';
import { Wrench } from 'lucide-react';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Maintenance', robots: { index: false } };

/** Maintenance / service unavailable (public-system-pages/05). No restoration time or status link is invented. */
export default function MaintenancePage() {
  return (
    <section className={s.hero} style={{ minHeight: 480 }}>
      <div className={`${s.container} ${s.center}`}>
        <span className={s.icon} style={{ width: 80, height: 80, margin: '0 auto 16px' }}>
          <Wrench size={34} />
        </span>
        <div className={s.eyebrow}>Scheduled Maintenance</div>
        <h1 className={s.h2}>AmpliVerify is temporarily unavailable</h1>
        <p className={s.lead}>We&apos;re performing maintenance to keep the platform reliable. Please check back shortly.</p>
        <div className={s.heroActions}>
          <Link href="/" className={s.btnOutline}>
            Go to Homepage
          </Link>
        </div>
      </div>
    </section>
  );
}
