import 'server-only';
import Link from 'next/link';
import { cache, type ReactNode } from 'react';
import { BarChart3, CalendarDays, Folder, Info, Link2, MessageSquareText, Target } from 'lucide-react';
import { ButtonLink, PageHeader } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { StateView } from '@/components/ui/StateView';
import { apiGet, apiList, qs } from '@/lib/api';
import type { BillingOverview, GeoOverview, GeoPlatformStatus, WorkspaceView } from '@/lib/app-types';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { AddPromptDialog } from './AddPromptDialog';
import s from './geo.module.css';

export type GeoTab = 'prompts' | 'trends' | 'citations' | 'platforms' | 'competitors' | 'opportunities';

/**
 * Tabs from the AI Search (GEO) design (chat image 2026-10-06). Each tab is a
 * standalone page with its own URL (navigation spec decision 3); Prompt
 * Tracking is the Overview itself, Visibility Trends is the page map's
 * History, Citations is Sources & Citations.
 */
export const GEO_TABS: { key: GeoTab; label: string; href: string }[] = [
  { key: 'prompts', label: 'Prompt Tracking', href: '/app/geo' },
  { key: 'trends', label: 'Visibility Trends', href: '/app/geo/history' },
  { key: 'citations', label: 'Citations', href: '/app/geo/citations' },
  { key: 'platforms', label: 'Platforms', href: '/app/geo/platforms' },
  { key: 'competitors', label: 'Competitors', href: '/app/geo/competitors' },
  { key: 'opportunities', label: 'Opportunities', href: '/app/geo/opportunities' },
];

const PERIODS = [
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['12m', 'Last 12 months'],
] as const;

export const geoPeriod = (p?: string) => (PERIODS.some(([v]) => v === p) ? p! : '30d');
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

/** Everything the GEO header needs, loaded once per request. */
export const loadGeo = cache(async (period: string) => {
  const { selectedProject: project, workspaceId } = await getAppContext();
  const [overview, platforms, billing, workspace] = await Promise.all([
    project ? apiGet<GeoOverview>(`/user/projects/${project.id}/geo/overview${qs({ period })}`, { auth: true }) : null,
    apiList<GeoPlatformStatus>('/public/geo-platforms/status'),
    workspaceId ? apiGet<BillingOverview>(`/user/workspaces/${workspaceId}/billing`, { auth: true }) : null,
    workspaceId ? apiGet<WorkspaceView>(`/user/workspaces/${workspaceId}`, { auth: true }) : null,
  ]);
  return {
    project,
    overview: overview?.ok ? overview.data : null,
    platforms,
    creditPerPlatform: billing?.ok ? (billing.data.creditCosts['geo.check'] ?? 0) : null,
    aiGeo: workspace?.ok ? (workspace.data.settings.aiGeo ?? {}) : {},
  };
});

/** Add Prompt control bound to the selected project (null without one). */
export async function AddPrompt({ period, label, size }: { period: string; label?: string; size?: 'md' | 'lg' }) {
  const g = await loadGeo(period);
  if (!g.project) return null;
  return <AddPromptDialog projectId={g.project.id} platforms={g.platforms} defaultPlatforms={g.aiGeo.defaultPlatforms} defaultCountry={g.aiGeo.defaultCountry} creditPerPlatform={g.creditPerPlatform} label={label} size={size} />;
}

/** Shared GEO header, summary metrics and tab bar. */
export async function GeoShell({ tab, period, children }: { tab: GeoTab; period: string; children: ReactNode }) {
  const current = GEO_TABS.find((t) => t.key === tab)!;
  const { project, overview: o } = await loadGeo(period);
  const best = o?.platforms.filter((p) => p.visibility !== null).sort((a, b) => b.visibility! - a.visibility!)[0];
  const metrics = [
    { label: 'Total Prompts', value: o ? o.prompts.toLocaleString('en-US') : '—', icon: <MessageSquareText size={26} />, tone: 'purple', info: 'Active prompts tracked for the selected project.' },
    { label: 'Avg. Visibility Score', value: pct(o?.visibility), icon: <BarChart3 size={26} />, tone: 'green', info: 'Share of the latest AI answers in this period that mention your brand.' },
    { label: 'Total Citations', value: o ? o.citations.toLocaleString('en-US') : '—', icon: <Link2 size={26} />, tone: 'amber', info: 'Sources cited in the latest AI answers for your prompts.' },
    { label: 'Highest Visibility Platform', value: best ? `${best.name}` : '—', icon: <Target size={26} />, tone: 'red', info: best ? `${best.visibility}% visibility on ${best.name}.` : 'The platform where your brand is most visible.' },
  ];
  return (
    <>
      <PageHeader
        title="AI Search (GEO)"
        description="Track how your brand and content appear in AI-generated search results. Monitor visibility, citations, and opportunities across AI search platforms."
        crumbs={tab === 'prompts' ? undefined : appCrumbs({ label: 'AI Search (GEO)', href: '/app/geo' }, { label: current.label })}
        actions={
          <>
            <form className={s.period}>
              <CalendarDays size={18} aria-hidden />
              <AutoSubmitSelect name="period" defaultValue={period} aria-label="Reporting period">
                {PERIODS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </AutoSubmitSelect>
              <noscript>
                <button type="submit">Apply</button>
              </noscript>
            </form>
            <AddPrompt period={period} />
          </>
        }
      />
      <div className={s.metrics}>
        {metrics.map((m) => (
          <div key={m.label} className={s.metric}>
            <span className={s.metricIcon} data-tone={m.tone}>
              {m.icon}
            </span>
            <span style={{ minWidth: 0 }}>
              <b>{m.value}</b>
              <small>
                {m.label} <Info size={14} aria-label={m.info} />
              </small>
            </span>
          </div>
        ))}
      </div>
      <nav className={s.tabs} aria-label="AI Search (GEO)">
        {GEO_TABS.map((t) => (
          <Link key={t.key} href={`${t.href}${qs({ period: period === '30d' ? undefined : period })}`} className={t.key === tab ? s.tabOn : undefined} aria-current={t.key === tab ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className={s.body}>
        {project ? (
          children
        ) : (
          <StateView
            kind="empty"
            icon={<Folder size={40} />}
            title="Select a project"
            description="AI search visibility is tracked per project. Choose a project to add prompts."
            action={<ButtonLink href="/app/projects">Select a Project</ButtonLink>}
          />
        )}
      </div>
    </>
  );
}

/** Table frame for the GEO tabs; `empty` shows below the header when there are no rows. */
export function GeoTable({ columns, rows, empty }: { columns: string[]; rows: ReactNode[][]; empty?: ReactNode }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        {rows.length > 0 && (
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {rows.length === 0 && empty}
    </div>
  );
}
