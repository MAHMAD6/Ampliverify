import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, Info, Link2, MessageSquareText, Plus, Target, BarChart3 } from 'lucide-react';
import { Button, PageHeader } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { appCrumbs } from '@/lib/nav';
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
] as const;

/**
 * Shared GEO header, summary metrics and tab bar. Metrics come from the GEO
 * API (`geo_prompts`, `geo_visibility_snapshots`, `geo_citations`), which is
 * not built yet, so they read "—"; Add Prompt is disabled for the same reason.
 */
export function GeoShell({ tab, period, children }: { tab: GeoTab; period: string; children: ReactNode }) {
  const current = GEO_TABS.find((t) => t.key === tab)!;
  const metrics = [
    { label: 'Total Prompts', icon: <MessageSquareText size={26} />, tone: 'purple', info: 'Prompts tracked for the selected project.' },
    { label: 'Avg. Visibility Score', icon: <BarChart3 size={26} />, tone: 'green', info: 'Average visibility across tracked prompts and platforms.' },
    { label: 'Total Citations', icon: <Link2 size={26} />, tone: 'amber', info: 'Times your content was cited in AI answers.' },
    { label: 'Highest Visibility Platform', icon: <Target size={26} />, tone: 'red', info: 'The platform where your brand is most visible.' },
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
            <Button size="lg" icon={<Plus size={18} />} disabled title="Prompt tracking is not available for your account yet.">
              Add Prompt
            </Button>
          </>
        }
      />
      <div className={s.metrics}>
        {metrics.map((m) => (
          <div key={m.label} className={s.metric}>
            <span className={s.metricIcon} data-tone={m.tone}>
              {m.icon}
            </span>
            <span>
              <b>—</b>
              <small>
                {m.label} <Info size={14} aria-label={m.info} />
              </small>
            </span>
          </div>
        ))}
      </div>
      <nav className={s.tabs} aria-label="AI Search (GEO)">
        {GEO_TABS.map((t) => (
          <Link key={t.key} href={t.href} className={t.key === tab ? s.tabOn : undefined} aria-current={t.key === tab ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className={s.body}>{children}</div>
    </>
  );
}

/** Empty table body used by the GEO tabs. */
export function GeoTable({ columns, children }: { columns: string[]; children: ReactNode }) {
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
      </table>
      {children}
    </div>
  );
}
