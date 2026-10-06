import Link from 'next/link';
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Button, Input, Select } from '../ui';
import { AUDIT_CATEGORIES, RANGES, type AuditFilters, type AuditRecord } from '@/lib/audit';
import s from './audit.module.css';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

/**
 * Filterable list of server-recorded audit events. Filters are a plain GET
 * form over the records the API returned; nothing is synthesized. IP
 * addresses and device data are only shown on the event detail page.
 */
export function AuditTable({
  records,
  filters,
  actors,
  detailBase,
  searchLabel,
  actorFilter,
  empty,
}: {
  records: AuditRecord[];
  filters: AuditFilters;
  actors: Map<string, string>;
  detailBase: string;
  searchLabel: string;
  actorFilter: boolean;
  empty: ReactNode;
}) {
  const actorIds = [...new Set(records.map((r) => r.actorUserId).filter(Boolean))] as string[];
  return (
    <>
      <form className={s.filters} role="search">
        <Input name="q" defaultValue={filters.q} icon={<Search size={16} />} placeholder={searchLabel} aria-label={searchLabel} />
        {actorFilter ? (
          <Select name="actor" defaultValue={filters.actor ?? ''} aria-label="Admin">
            <option value="">All admins</option>
            {actorIds.map((id) => (
              <option key={id} value={id}>
                {actors.get(id) ?? id}
              </option>
            ))}
          </Select>
        ) : null}
        <Select name="category" defaultValue={filters.category ?? ''} aria-label="Category">
          <option value="">{actorFilter ? 'All action types' : 'All categories'}</option>
          {AUDIT_CATEGORIES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Select name="range" defaultValue={filters.range ?? ''} aria-label="Date range">
          <option value="">Any date</option>
          {RANGES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
      {records.length === 0 ? (
        empty
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Scope</th>
                <th aria-label="Details" />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className={s.nowrap}>{when(r.createdAt)}</td>
                  <td>
                    {r.actorUserId ? actors.get(r.actorUserId) ?? <code>{r.actorUserId.slice(0, 8)}</code> : 'System'}
                    {r.actorRole && <small className={s.role}>{r.actorRole}</small>}
                  </td>
                  <td>
                    <code>{r.eventType}</code>
                  </td>
                  <td>
                    {r.targetType}
                    {r.targetId && <small className={s.sub}>{r.targetId.slice(0, 8)}</small>}
                  </td>
                  <td>{r.workspaceId ? 'Workspace' : r.organizationId ? 'Organization' : 'Platform'}</td>
                  <td>
                    <Link href={`${detailBase}/${r.id}`} className={s.view}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
