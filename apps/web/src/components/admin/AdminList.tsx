import Link from 'next/link';
import type { ReactNode } from 'react';
import { Info, Search } from 'lucide-react';
import { Input, Select } from '../ui';
import { AdminHeader } from './AdminParts';
import s from './list.module.css';

export type ListMetric = { label: string; icon: ReactNode; tone: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'slate'; value?: ReactNode; note?: string };
export type ListTab = { key: string; label: string };
/** Options are labels, or [value, label] pairs; the first option is the empty "all" choice. */
export type ListSelect = { label?: string; name?: string; value?: string; options: (string | [string, string])[] };

/**
 * Shared Super Admin list layout from the admin redesign (chat images
 * 2026-10-06): header + optional About panel, icon metrics, tabs, filters,
 * table and a backend-derived empty state. Metrics without a value render
 * "—"; tables render `rows` only when the API supplied them. Filters are
 * disabled unless the page wires them (`liveFilters`).
 */
export function AdminList({
  section,
  title,
  description,
  about,
  actions,
  metrics,
  tabs,
  activeTab,
  basePath,
  search,
  selects = [],
  columns,
  rows,
  empty,
  footnote,
  liveFilters,
  children,
}: {
  section: string;
  title: string;
  description: string;
  about?: { title: string; text: string };
  actions?: ReactNode;
  metrics?: ListMetric[];
  tabs?: ListTab[];
  activeTab?: string;
  basePath: string;
  search: string;
  selects?: ListSelect[];
  columns: string[];
  rows?: ReactNode[][];
  empty: { icon: ReactNode; title: string; text: string; action?: ReactNode };
  footnote?: string;
  liveFilters?: { q?: string };
  children?: ReactNode;
}) {
  const hasRows = !!rows && rows.length > 0;
  return (
    <>
      <div className={about ? s.head : undefined}>
        <AdminHeader section={section} title={title} description={description} actions={actions} />
        {about && (
          <aside className={s.about}>
            <Info size={22} />
            <div>
              <b>{about.title}</b>
              <p>{about.text}</p>
            </div>
          </aside>
        )}
      </div>
      {metrics && (
        <div className={s.metrics} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${metrics.length > 4 ? 170 : 220}px, 1fr))` }}>
          {metrics.map((m) => (
            <div key={m.label} className={s.metric}>
              <span className={s.icon} data-tone={m.tone}>
                {m.icon}
              </span>
              <span>
                <small>{m.label}</small>
                <b>{m.value ?? '—'}</b>
                {m.note && <em>{m.note}</em>}
              </span>
            </div>
          ))}
        </div>
      )}
      {children}
      <section className={s.panel}>
        {tabs && (
          <nav className={s.tabs} aria-label={`${title} views`}>
            {tabs.map((t, i) => {
              const on = (activeTab ?? tabs[0].key) === t.key;
              return (
                <Link key={t.key} href={i === 0 ? basePath : `${basePath}?tab=${t.key}`} className={on ? s.tabOn : undefined} aria-current={on ? 'page' : undefined}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        )}
        <form className={s.filters} role="search">
          {activeTab && <input type="hidden" name="tab" value={activeTab} />}
          <Input name="q" icon={<Search size={16} />} placeholder={search} aria-label={search} defaultValue={liveFilters?.q} disabled={!liveFilters} />
          {selects.map((sel) => (
            <label key={String(sel.options[0])} className={s.select}>
              {sel.label && <span>{sel.label}</span>}
              <Select name={sel.name} defaultValue={sel.value ?? ''} disabled={!liveFilters || !sel.name} aria-label={sel.label ?? String(sel.options[0])}>
                {sel.options.map((o, i) => {
                  const [v, l] = Array.isArray(o) ? o : [o, o];
                  return (
                    <option key={v} value={i === 0 ? '' : v}>
                      {l}
                    </option>
                  );
                })}
              </Select>
            </label>
          ))}
          {liveFilters && (
            <Link href={activeTab ? `${basePath}?tab=${activeTab}` : basePath} className={s.clear}>
              Clear Filters
            </Link>
          )}
        </form>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            {hasRows && (
              <tbody>
                {rows!.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!hasRows && (
          <div className={s.empty}>
            <span className={s.emptyIcon}>{empty.icon}</span>
            <b>{empty.title}</b>
            <p>{empty.text}</p>
            {empty.action}
          </div>
        )}
        {footnote && (
          <p className={s.footnote}>
            <Info size={18} /> {footnote}
          </p>
        )}
      </section>
    </>
  );
}

export function StatusPill({ tone, children }: { tone: 'green' | 'slate' | 'amber' | 'red' | 'blue'; children: ReactNode }) {
  return (
    <span className={s.pill} data-tone={tone}>
      {children}
    </span>
  );
}
