import { notFound } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { Badge, Notice, PageHeader, Panel } from '@/components/ui';
import { ActionButton, AutoRefresh } from '@/components/ui/actions';
import { ReportSections, type SectionPayload } from '@/components/app/reports/ReportSections';
import { ShareReportButton } from '@/components/app/reports/ReportControls';
import { REPORT_TYPES } from '@/components/app/reports/meta';
import { apiGet } from '@/lib/api';
import { appCrumbs } from '@/lib/nav';
import { formatDate, formatDateTime } from '@/lib/format';

export const metadata = { title: 'Report' };

type ReportDetail = {
  id: string;
  projectId: string;
  type: string;
  status: string;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  project: { id: string; name: string };
  sections: { sectionKey: string; position: number; payload: SectionPayload }[];
  files: { id: string; format: string; sizeBytes: string; createdAt: string }[];
  shares: { id: string; expiresAt: string | null; revokedAt: string | null; createdAt: string }[];
  schedule: { name: string; cadence: string } | null;
};

/** A generated report: sections rendered from stored payloads, downloads and share links. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const res = await apiGet<ReportDetail>(`/user/reports/${encodeURIComponent((await params).id)}`, { auth: true });
  if (!res.ok) notFound();
  const r = res.data;
  const building = r.status === 'QUEUED' || r.status === 'RUNNING';
  return (
    <>
      <AutoRefresh active={building} seconds={3} />
      <PageHeader
        title={r.title}
        description={`${REPORT_TYPES.find(([v]) => v === r.type)?.[1] ?? r.type} · ${r.project.name} · ${r.periodStart ? `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}` : ''}`}
        crumbs={appCrumbs({ label: 'Reports', href: '/app/reports' }, { label: r.title })}
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {r.files.map((f) => (
              <a key={f.id} href={`/api/files/user/reports/${r.id}/download/${f.format}`} target={f.format === 'html' ? '_blank' : undefined} rel="noreferrer" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
                <Download size={16} /> {f.format.toUpperCase()}
              </a>
            ))}
          </div>
        }
      />
      {building && (
        <Notice tone="blue" title="Generating report…">
          <Loader2 size={14} style={{ verticalAlign: 'middle' }} /> This page updates automatically.
        </Notice>
      )}
      {r.status === 'FAILED' && <Notice tone="amber" title="The report could not be generated">Try generating it again.</Notice>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
        <ReportSections sections={r.sections.sort((a, b) => a.position - b.position).map((s) => s.payload)} />
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel title="Share" description="Read-only links for clients and stakeholders." flushHead>
            {r.status === 'SUCCEEDED' && <ShareReportButton reportId={r.id} />}
            {r.shares.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 8 }}>
                {r.shares.map((s) => (
                  <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, alignItems: 'center' }}>
                    <span>
                      Link created {formatDateTime(s.createdAt)}
                      <br />
                      {s.revokedAt ? <Badge>Revoked</Badge> : s.expiresAt && new Date(s.expiresAt) < new Date() ? <Badge>Expired</Badge> : <small style={{ color: 'var(--muted)' }}>Expires {formatDate(s.expiresAt)}</small>}
                    </span>
                    {!s.revokedAt && (
                      <ActionButton size="sm" variant="ghost" path={`/user/report-shares/${s.id}/revoke`} confirm="Revoke this link? Anyone using it will lose access.">
                        Revoke
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Details" flushHead>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 14, margin: 0 }}>
              <dt>Status</dt>
              <dd style={{ margin: 0 }}>{r.status.toLowerCase()}</dd>
              <dt>Created</dt>
              <dd style={{ margin: 0 }}>{formatDateTime(r.createdAt)}</dd>
              {r.schedule && (
                <>
                  <dt>Schedule</dt>
                  <dd style={{ margin: 0 }}>
                    {r.schedule.name} ({r.schedule.cadence.toLowerCase()})
                  </dd>
                </>
              )}
            </dl>
            <div style={{ marginTop: 12 }}>
              <ActionButton variant="outline" path={`/user/projects/${r.projectId}/reports`} body={{ type: r.type, periodStart: r.periodStart ?? undefined, periodEnd: r.periodEnd ?? undefined }} redirectTo="/app/reports/{id}">
                Regenerate
              </ActionButton>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
