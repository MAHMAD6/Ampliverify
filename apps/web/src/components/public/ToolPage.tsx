import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { CheckList, CtaBand, PageHero } from './Blocks';
import s from './site.module.css';

export type ToolFeature = { icon: ReactNode; title: string; text: string };
export type ToolLink = { label: string; href: string };

/**
 * Public tool / product page: what the tool does, how it works and what you
 * get. It never shows sample findings or invented results (V2 guide §4.4).
 */
export function ToolPage({
  eyebrow,
  title,
  lead,
  primary,
  secondary,
  features,
  steps,
  facts,
  related,
  cta,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: string;
  primary: ToolLink;
  secondary?: ToolLink;
  features: ToolFeature[];
  steps: { title: string; text: string }[];
  facts?: { title: string; items: string[] };
  related?: ToolLink[];
  cta: { title: string; text: string; primary?: ToolLink; secondary?: ToolLink };
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} lead={lead} center>
        <div className={s.heroActions}>
          <Link href={primary.href} className={s.btn}>
            {primary.label} <ArrowRight size={18} />
          </Link>
          {secondary && (
            <Link href={secondary.href} className={s.btnOutline}>
              {secondary.label}
            </Link>
          )}
        </div>
      </PageHero>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.grid3}>
            {features.map((f) => (
              <div key={f.title} className={s.card}>
                <span className={s.icon} aria-hidden>
                  {f.icon}
                </span>
                <h2 className={s.cardTitle}>{f.title}</h2>
                <p className={s.cardText}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className={s.sectionAlt}>
        <div className={s.container}>
          <div className={s.eyebrow}>How it works</div>
          <h2 className={s.h2}>From first check to measurable progress</h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {steps.map((st, i) => (
              <li key={st.title} className={s.card}>
                <span style={{ display: 'inline-grid', placeItems: 'center', width: 36, height: 36, borderRadius: '50%', background: 'var(--g900)', color: '#fff', fontWeight: 800 }}>{i + 1}</span>
                <h3 className={s.cardTitle}>{st.title}</h3>
                <p className={s.cardText}>{st.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      {(facts || related) && (
        <section className={s.section}>
          <div className={s.container} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {facts && (
              <div>
                <h2 className={s.h2} style={{ fontSize: 28 }}>
                  {facts.title}
                </h2>
                <CheckList items={facts.items} />
              </div>
            )}
            {related && (
              <div>
                <h2 className={s.h2} style={{ fontSize: 28 }}>
                  Related tools
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                  {related.map((r) => (
                    <li key={r.href}>
                      <Link href={r.href} className={s.learn}>
                        {r.label} <ArrowRight size={16} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
      <CtaBand title={cta.title} text={cta.text} primary={cta.primary} secondary={cta.secondary} />
    </>
  );
}
