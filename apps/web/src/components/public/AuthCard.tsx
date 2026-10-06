import type { ReactNode } from 'react';
import s from './site.module.css';

/** Centered auth card on the public hero (public-auth batch). */
export function AuthCard({ eyebrow, title, lead, cardTitle, cardText, children }: { eyebrow: string; title: string; lead: string; cardTitle: string; cardText: string; children: ReactNode }) {
  return (
    <>
      <section className={s.hero} style={{ paddingBottom: 120 }}>
        <div className={`${s.container} ${s.center}`}>
          <div className={s.eyebrow}>{eyebrow}</div>
          <h1 className={s.h1} style={{ fontSize: 'clamp(32px, 4vw, 46px)' }}>
            {title}
          </h1>
          <p className={s.lead}>{lead}</p>
        </div>
      </section>
      <section style={{ marginTop: -80, paddingBottom: 80 }}>
        <div className={s.card} style={{ width: 'min(520px, calc(100% - 40px))', margin: '0 auto', padding: 32, boxShadow: '0 24px 50px -30px rgba(11, 27, 53, 0.35)' }}>
          <h2 style={{ fontSize: 24 }}>{cardTitle}</h2>
          <p className={s.cardText} style={{ marginBottom: 20 }}>
            {cardText}
          </p>
          {children}
        </div>
      </section>
    </>
  );
}
