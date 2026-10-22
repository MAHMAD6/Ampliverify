import Link from 'next/link';
import { BarChart3, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { Badge, ButtonLink, Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';

export type GoogleSource = {
  dataSourceId: string;
  source: 'GOOGLE_SEARCH_CONSOLE' | 'GOOGLE_ANALYTICS';
  sourceLabel: string;
  propertyId: string | null;
  account: string | null;
  status: string;
  lastSyncAt: string | null;
  lastRun: { status: string; at: string; errorCode: string | null; dataThrough: string | null } | null;
  totals: { clicks?: number | null; impressions?: number | null; sessions?: number | null; activeUsers?: number | null };
  daily: { date: string; clicks?: number | null; impressions?: number | null; sessions?: number | null; activeUsers?: number | null }[];
  note: string;
};

const ERROR_TEXT: Record<string, string> = {
  GOOGLE_REAUTH_REQUIRED: 'Reconnect Google to continue syncing.',
  GOOGLE_PROPERTY_ACCESS: 'Access to this property is unavailable.',
  GA4_ACCESS_DENIED: 'You do not have access to this Analytics property.',
  GOOGLE_QUOTA: 'Google data temporarily unavailable.',
  GOOGLE_UNAVAILABLE: 'Google data temporarily unavailable.',
  GOOGLE_TIMEOUT: 'Analysis taking longer than expected.',
};

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 28}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" style={{ width: '100%', height: 36 }} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatNumber(v));

/** Search Console and GA4 for a project: authorized data with source, freshness and safe states (Google manual §1, §8). */
export function GoogleDataPanel({ projectId, sources }: { projectId: string; sources: GoogleSource[] }) {
  return (
    <Panel
      title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><BarChart3 size={20} color="var(--blue)" /> Search & Traffic (Google)</span>}
      description="Last 28 days from your connected Google properties."
      actions={
        sources.length ? (
          <ActionButton size="sm" variant="outline" icon={<RefreshCw size={14} />} path={`/user/projects/${projectId}/google/sync`} body={{}} successMessage="Sync queued. Data appears within a few minutes.">
            Sync now
          </ActionButton>
        ) : undefined
      }
      flushHead
    >
      {sources.length === 0 ? (
        <div style={{ display: 'grid', gap: 10, fontSize: 14, color: 'var(--muted)' }}>
          <p style={{ margin: 0 }}>Connect Google Search Console and Google Analytics 4 to see authorized clicks, impressions, sessions and active users here.</p>
          <div>
            <ButtonLink href="/app/settings/integrations" variant="outline" size="sm">
              Connect Google
            </ButtonLink>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {sources.map((src) => {
            const gsc = src.source === 'GOOGLE_SEARCH_CONSOLE';
            const reauth = src.status === 'REAUTH_REQUIRED';
            const err = src.lastRun?.status === 'FAILED' ? (ERROR_TEXT[src.lastRun.errorCode ?? ''] ?? 'The last sync failed. We will retry automatically.') : null;
            const empty = src.daily.length === 0;
            return (
              <div key={src.dataSourceId} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--heading)' }}>
                    {gsc ? <Search size={16} /> : <BarChart3 size={16} />} {src.sourceLabel}
                  </strong>
                  <Badge tone={reauth || err ? 'amber' : 'green'}>{reauth ? 'Reconnect' : err ? 'Attention' : 'Connected'}</Badge>
                </div>
                <small style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>{src.propertyId}</small>
                {reauth ? (
                  <p style={{ margin: 0, fontSize: 14, display: 'flex', gap: 6 }}>
                    <TriangleAlert size={16} color="var(--amber)" /> Reconnect Google to continue syncing. <Link href="/app/settings/integrations" style={{ color: 'var(--blue)' }}>Reconnect</Link>
                  </p>
                ) : empty ? (
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>{src.lastSyncAt ? 'No data available for this period.' : 'First sync in progress — data appears within a few minutes.'}</p>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <b style={{ fontSize: 22, color: 'var(--heading)' }}>{n(gsc ? src.totals.clicks : src.totals.sessions)}</b>
                        <small style={{ display: 'block', color: 'var(--muted)' }}>{gsc ? 'Clicks' : 'Sessions'}</small>
                      </div>
                      <div>
                        <b style={{ fontSize: 22, color: 'var(--heading)' }}>{n(gsc ? src.totals.impressions : src.totals.activeUsers)}</b>
                        <small style={{ display: 'block', color: 'var(--muted)' }}>{gsc ? 'Impressions' : 'Active users'}</small>
                      </div>
                    </div>
                    <Spark values={src.daily.map((d) => (gsc ? (d.clicks ?? 0) : (d.sessions ?? 0)))} />
                  </>
                )}
                {err && !reauth && <small style={{ color: 'var(--amber)' }}>{err}</small>}
                <small style={{ color: 'var(--muted)' }}>
                  Source: {src.sourceLabel}
                  {src.account ? ` (${src.account})` : ''} · {src.lastSyncAt ? `last sync ${formatDateTime(src.lastSyncAt)}` : 'not synced yet'}
                  {src.lastRun?.dataThrough ? ` · data through ${formatDate(src.lastRun.dataThrough)}` : ''}
                </small>
                <small style={{ color: 'var(--muted)' }}>{src.note}</small>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
