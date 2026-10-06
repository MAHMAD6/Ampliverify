'use client';

import Link from 'next/link';
import s from '@/components/public/site.module.css';

/** 500 / general error (public-system-pages/04). No incident details are invented. */
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className={s.hero} style={{ minHeight: 480 }}>
      <div className={`${s.container} ${s.center}`}>
        <div className={s.eyebrow}>Something Went Wrong</div>
        <div style={{ fontSize: 'clamp(80px, 12vw, 120px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>500</div>
        <h1 className={s.h2}>We hit an unexpected error</h1>
        <p className={s.lead}>Please try again. If the problem continues, contact support.</p>
        <div className={s.heroActions}>
          <button type="button" className={s.btn} onClick={reset}>
            Try Again
          </button>
          <Link href="/" className={s.btnOutline}>
            Go to Homepage
          </Link>
          <Link href="/contact?topic=support" className={s.btnOutline}>
            Contact Support
          </Link>
        </div>
      </div>
    </section>
  );
}
