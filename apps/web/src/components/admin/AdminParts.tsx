import type { ReactNode } from 'react';
import { CircleCheck, Search } from 'lucide-react';
import { DataTable, EmptyState, Grid, Input, KeyValue, Metric, PageHeader, Panel, Select, type Crumb } from '../ui';
import s from './parts.module.css';

/** Breadcrumbs always start at the Command Center. */
export function AdminHeader({ section, page, title, description, actions, parent }: { section: string; page?: string; title: string; description: string; actions?: ReactNode; parent?: Crumb }) {
  const crumbs: Crumb[] = [{ label: 'Command Center', href: '/admin' }, { label: section }, ...(parent ? [parent] : []), { label: page ?? title }];
  return <PageHeader title={title} description={description} crumbs={crumbs} actions={actions} />;
}

/** Four backend-derived metrics. Values stay "—" until the admin API supplies them. */
export function MetricRow({ items }: { items: { label: string; note: string; value?: ReactNode }[] }) {
  return (
    <Grid cols={4} style={{ marginBottom: 18 }}>
      {items.map((m) => (
        <Metric key={m.label} label={m.label} value={m.value} note={m.note} />
      ))}
    </Grid>
  );
}

export function FilterBar({ search, selects }: { search: string; selects: string[] }) {
  return (
    <div className={s.filters}>
      <Input icon={<Search size={16} />} placeholder={search} aria-label={search} disabled />
      {selects.map((label) => (
        <Select key={label} aria-label={label} disabled>
          <option>{label}</option>
        </Select>
      ))}
    </div>
  );
}

export function ListPanel({
  title,
  description,
  search,
  selects = [],
  columns,
  emptyIcon,
  emptyTitle,
  emptyText,
  action,
}: {
  title: string;
  description: string;
  search: string;
  selects?: string[];
  columns?: string[];
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyText: string;
  action?: ReactNode;
}) {
  const empty = <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyText} action={action} />;
  return (
    <Panel title={title} description={description} bodyless>
      <FilterBar search={search} selects={selects} />
      {columns ? <DataTable selectable columns={columns} empty={empty} /> : empty}
    </Panel>
  );
}

/** Internal operating rules shown to administrators (not end users). */
export function Guidelines({ title, description, items }: { title: string; description: string; items: string[] }) {
  return (
    <Panel title={title} description={description} flushHead>
      <ul className={s.guidelines}>
        {items.map((item) => (
          <li key={item}>
            <CircleCheck size={16} /> {item}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function StatusPanel({ title, description, rows }: { title: string; description: string; rows: [string, string][] }) {
  return (
    <Panel title={title} description={description} flushHead>
      {rows.map(([k, v]) => (
        <KeyValue key={k} label={k} value={v} />
      ))}
    </Panel>
  );
}

export function Dropzone({ title, hint, icon }: { title: string; hint: string; icon: ReactNode }) {
  return (
    <div className={s.dropzone} aria-disabled="true">
      {icon}
      <strong>{title}</strong>
      <span>{hint}</span>
    </div>
  );
}
