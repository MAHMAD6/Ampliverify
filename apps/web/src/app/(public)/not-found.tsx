import Link from 'next/link';
import s from '@/components/public/site.module.css';

/** 404 (public-system-pages/03). */
export default function NotFound() {
  return (
    <section className={s.hero} style={{ minHeight: 480 }}>
      <div className={`${s.container} ${s.center}`}>
        <div className={s.eyebrow}>Page Not Found</div>
        <div style={{ fontSize: 'clamp(80px, 12vw, 120px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>404</div>
        <h1 className={s.h2}>We couldn&apos;t find that page</h1>
        <p className={s.lead}>The page may have moved, the address may be incorrect, or the content may no longer be available.</p>
        <div className={s.heroActions}>
          <Link href="/" className={s.btn}>
            Go to Homepage
          </Link>
          <Link href="/features" className={s.btnOutline}>
            View Features
          </Link>
          <Link href="/help" className={s.btnOutline}>
            Help Center
          </Link>
        </div>
      </div>
    </section>
  );
}
