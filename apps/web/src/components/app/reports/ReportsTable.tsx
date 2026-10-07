import Link from 'next/link';
import { Download, FileSearch } from 'lucide-react';
import { Badge, DataTable, EmptyState } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import type { ReportRow } from '@/lib/app-types';
import { formatDate } from '@/lib/format';
import { REPORT_STATUSES, REPORT_TYPES } from './meta';

const typeLabel = (t: string) => REPORT_TYPES.find(([v]) => v === t)?.[1] ?? t;
const statusLabel = (s: string) => REPORT_STATUSES.find(([v]) => v === s)?.[1] ?? s;

export function ReportsTable({ reports, emptyText = 'Generate a report from any project to see it here.' }: { reports: ReportRow[]; emptyText?: string }) {
  return (
    <DataTable
      columns={['Report', 'Project', 'Type', 'Period', 'Status', 'Created', 'Actions']}
      rows={reports.map((r) => [
        <Link key="t" href={`/app/reports/${r.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          {r.title}
        </Link>,
        r.project.name,
        typeLabel(r.type),
        r.periodStart ? `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}` : '—',
        <Badge key="s" tone={r.status === 'SUCCEEDED' ? 'green' : r.status === 'FAILED' ? 'amber' : 'blue'}>
          {statusLabel(r.status)}
        </Badge>,
        formatDate(r.createdAt),
        <div key="a" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {r.files.some((f) => f.format === 'pdf') && (
            <a href={`/api/files/user/reports/${r.id}/download/pdf`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: 'var(--blue)', fontSize: 14 }}>
              <Download size={14} /> PDF
            </a>
          )}
          {r.shares.length > 0 && <Badge>Shared</Badge>}
          <ActionButton size="sm" variant="ghost" method="DELETE" path={`/user/reports/${r.id}`} confirm={`Delete “${r.title}”? This cannot be undone.`} revalidate={['/app/reports']}>
            Delete
          </ActionButton>
        </div>,
      ])}
      empty={<EmptyState icon={<FileSearch size={32} />} title="No reports yet" description={emptyText} />}
    />
  );
}
