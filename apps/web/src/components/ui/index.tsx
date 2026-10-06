import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Info } from 'lucide-react';
import s from './ui.module.css';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/* ── Button ──────────────────────────────────────────────────────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'green' | 'greenOutline' | 'muted';

type ButtonBase = { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; block?: boolean; icon?: ReactNode };

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonBase & ComponentProps<'button'>) {
  return (
    <button type={type} className={cx(s.btn, s[variant], size !== 'md' && s[size], block && s.block, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  className,
  children,
  href,
}: ButtonBase & { href: string; className?: string; children?: ReactNode }) {
  return (
    <Link href={href} className={cx(s.btn, s[variant], size !== 'md' && s[size], block && s.block, className)}>
      {icon}
      {children}
    </Link>
  );
}

/* ── Surfaces ────────────────────────────────────────────────────────── */

export function Card({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={cx(s.card, className)} {...rest}>
      {children}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  flushHead,
  bodyless,
  className,
  children,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  flushHead?: boolean;
  /** Render children directly under the header without body padding (tables, lists). */
  bodyless?: boolean;
  className?: string;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <section className={cx(s.panel, className)} id={id}>
      {(title || actions) && (
        <header className={cx(s.panelHead, flushHead && s.flush)}>
          <div>
            {title && <h2 className={s.panelTitle}>{title}</h2>}
            {description && <p className={s.panelDesc}>{description}</p>}
          </div>
          {actions && <div className={s.panelActions}>{actions}</div>}
        </header>
      )}
      {bodyless ? children : <div className={s.panelBody}>{children}</div>}
    </section>
  );
}

/* ── Page header ─────────────────────────────────────────────────────── */

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className={s.pageHead}>
      <div>
        {crumbs && crumbs.length > 0 && (
          <nav className={s.crumbs} aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={c.label}>
                {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
                {i < crumbs.length - 1 && <span aria-hidden> ›</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className={s.pageTitle}>{title}</h1>
        {description && <p className={s.pageDesc}>{description}</p>}
      </div>
      {actions && <div className={s.pageActions}>{actions}</div>}
    </div>
  );
}

/* ── Metric tile ─────────────────────────────────────────────────────── */

export type Tone = 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'slate';

export function Metric({
  label,
  value,
  note,
  icon,
  tone = 'blue',
  info,
}: {
  label: ReactNode;
  value?: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  info?: string;
}) {
  return (
    <Card className={s.metric}>
      {icon && <div className={cx(s.metricIcon, s[`tone-${tone}`])}>{icon}</div>}
      <div>
        <div className={s.metricValue}>{value ?? '—'}</div>
        <div className={s.metricLabel}>
          {label}
          {info && (
            <span title={info} aria-label={info}>
              <Info size={14} />
            </span>
          )}
        </div>
        {note && <div className={s.metricNote}>{note}</div>}
      </div>
    </Card>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  hint,
  compact,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  hint?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx(s.empty, compact && s.compact)}>
      {icon && <div className={s.emptyIcon}>{icon}</div>}
      <div className={s.emptyTitle}>{title}</div>
      {description && <p className={s.emptyText}>{description}</p>}
      {(action || hint) && (
        <div className={s.emptyAction}>
          {action}
          {hint && <span className={s.emptyHint}>{hint}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Notice ──────────────────────────────────────────────────────────── */

export function Notice({
  tone = 'blue',
  title,
  children,
  icon = <Info size={16} />,
}: {
  tone?: 'blue' | 'neutral' | 'green' | 'amber';
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={cx(s.notice, tone !== 'blue' && s[`notice-${tone}`])} role="note">
      {icon}
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  );
}

/* ── Forms ───────────────────────────────────────────────────────────── */

export function Field({ label, hint, htmlFor, children }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}

export function Input({ className, icon, ...rest }: ComponentProps<'input'> & { icon?: ReactNode }) {
  const input = <input className={cx(s.input, className)} {...rest} />;
  return icon ? (
    <div className={s.inputIconWrap}>
      {icon}
      {input}
    </div>
  ) : (
    input
  );
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={cx(s.select, className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cx(s.textarea, className)} {...rest} />;
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className={s.formGrid}>{children}</div>;
}

/* ── Badge ───────────────────────────────────────────────────────────── */

export function Badge({ tone, children }: { tone?: 'blue' | 'green' | 'amber'; children: ReactNode }) {
  return <span className={cx(s.badge, tone && s[`badge-${tone}`])}>{children}</span>;
}

/* ── Tabs (route-based) ──────────────────────────────────────────────── */

export function TabNav({ tabs, active }: { tabs: { key: string; label: ReactNode; href: string; icon?: ReactNode }[]; active: string }) {
  return (
    <nav className={s.tabs} aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={cx(s.tab, t.key === active && s.tabActive)} aria-current={t.key === active ? 'page' : undefined}>
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/* ── Table with an empty body ────────────────────────────────────────── */

export function DataTable({
  columns,
  selectable,
  rows,
  empty,
}: {
  columns: ReactNode[];
  selectable?: boolean;
  rows?: ReactNode[][];
  empty?: ReactNode;
}) {
  const hasRows = rows && rows.length > 0;
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: 40 }}>
                <input type="checkbox" className={s.checkbox} aria-label="Select all" disabled={!hasRows} />
              </th>
            )}
            {columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        {hasRows && (
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {selectable && (
                  <td>
                    <input type="checkbox" className={s.checkbox} aria-label="Select row" />
                  </td>
                )}
                {row.map((cell, c) => (
                  <td key={c}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {!hasRows && empty}
    </div>
  );
}

/* ── Key/value + setting rows ────────────────────────────────────────── */

export function KeyValue({ label, value }: { label: ReactNode; value?: ReactNode }) {
  return (
    <div className={s.kv}>
      <span className={s.kvKey}>{label}</span>
      <span className={s.kvValue}>{value ?? 'Not available'}</span>
    </div>
  );
}

export function SettingRow({ title, description, control, icon }: { title: ReactNode; description?: ReactNode; control?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={s.settingRow}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {icon}
        <div>
          <div className={s.settingTitle}>{title}</div>
          {description && <div className={s.settingDesc}>{description}</div>}
        </div>
      </div>
      {control}
    </div>
  );
}

/* ── Layout helpers ──────────────────────────────────────────────────── */

export function Grid({ cols, children, style }: { cols: 2 | 3 | 4; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={s[`grid${cols}`]} style={style}>
      {children}
    </div>
  );
}

export function Stack({ children, gap }: { children: ReactNode; gap?: number }) {
  return (
    <div className={s.stack} style={gap ? { gap } : undefined}>
      {children}
    </div>
  );
}

export function IconCircle({ tone = 'blue', size = 44, children }: { tone?: Tone; size?: number; children: ReactNode }) {
  return (
    <span className={cx(s.metricIcon, s[`tone-${tone}`])} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

export { cx };
