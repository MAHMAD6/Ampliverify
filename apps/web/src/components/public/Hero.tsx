import type { ReactNode } from 'react';
import s from './public.module.css';

export function Hero({ eyebrow, title, children, actions }: { eyebrow: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={s.hero}>
      <div className={s.eyebrow}>{eyebrow}</div>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
      {actions && <div className={s.heroActions}>{actions}</div>}
    </section>
  );
}

export function NumberedList({ items }: { items: { title: string; text: string; mark?: ReactNode }[] }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={item.title} className={s.listitem}>
          <div className={s.dot}>{item.mark ?? i + 1}</div>
          <div>
            <h4>{item.title}</h4>
            <p>{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
