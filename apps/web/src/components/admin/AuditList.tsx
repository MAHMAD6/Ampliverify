import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { AdminList, type ListMetric } from './AdminList';
import { AUDIT_CATEGORIES, RANGES, filterRecords, type AuditFilters, type AuditRecord } from '@/lib/audit';
import { dateTime } from '@/lib/admin-data';

/** Shared body of Admin Activity and Audit Logs (chat designs 2026-10-06): live audit records with GET filters. */
export function AuditList({
  title,
  description,
  about,
  metrics,
  records,
  actors,
  filters,
  basePath,
  emptyTitle,
  footnote,
}: {
  title: string;
  description: string;
  about: { title: string; text: string };
  metrics: ListMetric[];
  records: AuditRecord[];
  actors: Map<string, string>;
  filters: AuditFilters;
  basePath: string;
  emptyTitle: string;
  footnote: string;
}) {
  const rows = filterRecords(records, filters);
  return (
    <AdminList
      section="System Operations"
      title={title}
      description={description}
      about={about}
      metrics={metrics}
      basePath={basePath}
      search="Search by user, event type, target, or reference..."
      liveFilters={{ q: filters.q }}
      selects={[
        { label: 'Event Type', name: 'category', value: filters.category, options: ['All Event Types', ...AUDIT_CATEGORIES] },
        { label: 'Date Range', name: 'range', value: filters.range, options: ['Any date', ...RANGES.map(([k, l]) => [k, l] as [string, string])] },
      ]}
      columns={['Date & Time', 'Actor', 'Actor Type', 'Event Type', 'Resource / Item', 'Details']}
      rows={rows.map((r) => [
        dateTime(r.createdAt),
        r.actorUserId ? actors.get(r.actorUserId) ?? <code>{r.actorUserId.slice(0, 8)}</code> : 'System',
        r.actorRole ?? (r.actorUserId ? 'User' : 'System'),
        <code key="e">{r.eventType}</code>,
        `${r.targetType}${r.targetId ? ` · ${r.targetId.slice(0, 8)}` : ''}`,
        <Link key="d" href={`${basePath}/${r.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          View
        </Link>,
      ])}
      empty={{ icon: <ScrollText size={40} />, title: records.length && !rows.length ? 'No records match your filters' : emptyTitle, text: 'Records will appear here when data is available. Use the filters above to search.' }}
      footnote={footnote}
    />
  );
}
