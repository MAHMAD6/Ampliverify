import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { ActionButton } from '@/components/ui/actions';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable, geoPeriod, loadGeo } from '@/components/app/geo/GeoShell';
import { apiGet, qs } from '@/lib/api';
import type { GeoOpportunity } from '@/lib/app-types';
import { formatDate, humanize } from '@/lib/format';
import s from '@/components/app/geo/geo.module.css';

export const metadata = { title: 'Opportunities · AI Search (GEO)' };

const STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED'] as const;
const PRIORITY: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };

/** Visibility opportunities generated from the latest checks (`geo_opportunities`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string; status?: string }> }) {
  const sp = await searchParams;
  const period = geoPeriod(sp.period);
  const status = STATUSES.find((x) => x === sp.status) ?? 'OPEN';
  const { project } = await loadGeo(period);
  const res = project ? await apiGet<GeoOpportunity[]>(`/user/projects/${project.id}/geo/opportunities${qs({ status })}`, { auth: true }) : null;
  const rows = res?.ok ? res.data : [];
  const move = (o: GeoOpportunity, to: (typeof STATUSES)[number], label: string, variant: 'outline' | 'ghost' = 'ghost') => (
    <ActionButton key={to} size="sm" variant={variant} method="PATCH" path={`/user/geo/opportunities/${o.id}`} body={{ status: to }}>
      {label}
    </ActionButton>
  );
  return (
    <GeoShell tab="opportunities" period={period}>
      <form className={s.filters} style={{ gridTemplateColumns: 'minmax(180px, 240px)' }}>
        <input type="hidden" name="period" value={period} />
        <AutoSubmitSelect name="status" aria-label="Status" defaultValue={status}>
          {STATUSES.map((x) => (
            <option key={x} value={x}>
              {humanize(x)}
            </option>
          ))}
        </AutoSubmitSelect>
      </form>
      <GeoTable
        columns={['Opportunity', 'Platform', 'Prompt', 'Priority', 'Found', 'Actions']}
        rows={rows.map((o) => [
          <span key="o" style={{ display: 'block', maxWidth: 520 }}>
            <b>{humanize(o.type)}</b>
            <span className={s.sub} style={{ fontSize: 13, color: 'var(--text)' }}>
              {o.action}
            </span>
          </span>,
          o.platform ?? '—',
          o.prompt ?? '—',
          PRIORITY[o.priority] ?? o.priority,
          formatDate(o.createdAt),
          <span key="a" className={s.rowActions}>
            {o.status === 'OPEN' && move(o, 'IN_PROGRESS', 'Start', 'outline')}
            {o.status !== 'DONE' && move(o, 'DONE', 'Mark Done')}
            {o.status !== 'DISMISSED' && o.status !== 'DONE' && move(o, 'DISMISSED', 'Dismiss')}
            {(o.status === 'DONE' || o.status === 'DISMISSED') && move(o, 'OPEN', 'Reopen')}
          </span>,
        ])}
        empty={
          <StateView
            kind="empty"
            compact
            icon={<Lightbulb size={28} />}
            title={status === 'OPEN' ? 'No open opportunities' : `No ${humanize(status).toLowerCase()} opportunities`}
            description={status === 'OPEN' ? 'Run prompt checks to find where competitors appear and you do not, and which sources AI platforms cite.' : 'Opportunities you update will be listed here.'}
            action={
              status === 'OPEN' ? (
                <Link href="/app/geo" style={{ color: 'var(--blue)', fontWeight: 600 }}>
                  Go to Prompt Tracking
                </Link>
              ) : undefined
            }
          />
        }
      />
    </GeoShell>
  );
}
