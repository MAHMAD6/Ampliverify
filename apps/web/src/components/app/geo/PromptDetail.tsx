import Link from 'next/link';
import {
  BarChart3,
  CalendarDays,
  Coins,
  Copy,
  FileText,
  Layers,
  Lightbulb,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button, PageHeader } from '@/components/ui';
import { appCrumbs } from '@/lib/nav';
import { formatDate } from '@/lib/format';
import s from './prompt.module.css';

export type PromptFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** Shape the GEO prompt API will return (`geo_prompts`, `geo_prompt_schedules`, `geo_platform_results`, `geo_citations`, `geo_opportunities`). */
export type GeoPromptDetail = {
  id: string;
  text: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
  lastCheckedAt: string | null;
  frequency: PromptFrequency;
  creditsPerCheck: number | null;
  platforms: { key: string; name: string }[];
  metrics: { avgVisibility: number | null; totalCitations: number | null; uniqueSources: number | null; trend90d: number | null };
  platformResults: { platformKey: string; visibilityScore: number | null; citations: number | null; topSource: string | null; lastCheckedAt: string | null }[];
  citations: { source: string; platform: string; position: number | null; lastSeenAt: string }[];
  opportunities: { title: string; platform: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }[];
};

export const PROMPT_TABS = [
  ['overview', 'Overview'],
  ['platforms', 'Results by Platform'],
  ['citations', 'Citations & Sources'],
  ['history', 'Visibility History'],
  ['competitors', 'Competitors'],
  ['opportunities', 'Opportunities'],
] as const;
export type PromptTab = (typeof PROMPT_TABS)[number][0];

const FREQ: Record<PromptFrequency, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };
const num = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-US'));
const when = (v: string | null) => (v ? formatDate(v) : '—');

function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>{icon}</span>
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </div>
  );
}

/**
 * Prompt Detail (chat design 2026-10-06). Renders a prompt returned by the GEO
 * API. Running checks, editing, duplicating and pausing need that API too, so
 * those actions are disabled; credit cost comes from the prompt, never a constant.
 */
export function PromptDetail({ prompt, tab }: { prompt: GeoPromptDetail; tab: PromptTab }) {
  const base = `/app/geo/prompts/${encodeURIComponent(prompt.id)}`;
  const cost = prompt.creditsPerCheck;
  const costLabel = cost === null ? '' : ` (${cost} credit${cost === 1 ? '' : 's'})`;

  const trend = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Visibility Trend</h2>
        <div className={s.filters}>
          <span className={s.pill}>
            <CalendarDays size={14} /> Last 90 days
          </span>
          <span className={s.pill}>
            <Layers size={14} /> All Platforms
          </span>
        </div>
      </header>
      <Empty
        icon={<TrendingUp size={28} />}
        title="No visibility data yet"
        text="Run a check to see how visibility changes over time for this prompt across your selected platforms."
        action={
          <Button disabled icon={<Play size={16} />}>
            Run a Check Now{costLabel}
          </Button>
        }
      />
    </section>
  );

  const platforms = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Platform Results</h2>
      </header>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Visibility Score</th>
              <th>Citations</th>
              <th>Top Source</th>
              <th>Last Checked</th>
            </tr>
          </thead>
          <tbody>
            {prompt.platforms.map((p) => {
              const r = prompt.platformResults.find((x) => x.platformKey === p.key);
              return (
                <tr key={p.key}>
                  <td className={s.platform}>
                    <span className={s.mono}>{p.name.charAt(0)}</span>
                    {p.name}
                  </td>
                  <td>{num(r?.visibilityScore ?? null)}</td>
                  <td>{num(r?.citations ?? null)}</td>
                  <td>{r?.topSource ?? '—'}</td>
                  <td>{when(r?.lastCheckedAt ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Link href="/app/settings/ai-geo" className={s.manage}>
        <Settings size={14} /> Manage Platforms
      </Link>
    </section>
  );

  const citations = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Top Citations</h2>
      </header>
      {prompt.citations.length === 0 ? (
        <Empty icon={<FileText size={26} />} title="No citations yet" text="Run a check to see the sources that cite your brand or content." />
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Source</th>
              <th>Platform</th>
              <th>Position</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {prompt.citations.map((c, i) => (
              <tr key={`${c.source}-${c.platform}`}>
                <td>{i + 1}</td>
                <td>{c.source}</td>
                <td>{c.platform}</td>
                <td>{num(c.position)}</td>
                <td>{when(c.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );

  const opportunities = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Related Opportunities</h2>
      </header>
      {prompt.opportunities.length === 0 ? (
        <Empty icon={<Lightbulb size={26} />} title="No opportunities yet" text="Run a check to discover relevant topics and content gaps based on this prompt." />
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Platform</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {prompt.opportunities.map((o) => (
              <tr key={o.title}>
                <td>{o.title}</td>
                <td>{o.platform}</td>
                <td>{o.priority.charAt(0) + o.priority.slice(1).toLowerCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );

  const competitors = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Competitors</h2>
      </header>
      <Empty icon={<Users size={26} />} title="No competitor data yet" text="Competitor mentions for this prompt appear after a check when competitor monitoring is enabled." />
    </section>
  );

  return (
    <>
      <PageHeader
        title="Prompt Detail"
        description="View detailed results, history, and source citations for this AI search prompt."
        crumbs={appCrumbs({ label: 'AI Search (GEO)', href: '/app/geo' }, { label: 'Prompt Tracking', href: '/app/geo/prompts' }, { label: 'Prompt Detail' })}
        actions={
          <>
            <Button variant="secondary" disabled icon={<Pencil size={16} />}>
              Edit Prompt
            </Button>
            <Button variant="secondary" disabled icon={<Copy size={16} />}>
              Duplicate
            </Button>
            <Button variant="secondary" disabled icon={prompt.status === 'PAUSED' ? <Play size={16} /> : <Pause size={16} />}>
              {prompt.status === 'PAUSED' ? 'Resume Tracking' : 'Pause Tracking'}
            </Button>
            <Button variant="secondary" disabled aria-label="More actions">
              <MoreHorizontal size={18} />
            </Button>
          </>
        }
      />

      <section className={s.summary}>
        <span className={s.bigIcon}>
          <MessageSquareText size={30} />
        </span>
        <div className={s.prompt}>
          <small>Prompt</small>
          <b>{prompt.text}</b>
          <dl className={s.facts}>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={s.status} data-status={prompt.status}>
                  {prompt.status === 'ACTIVE' ? 'Active' : 'Paused'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{when(prompt.createdAt)}</dd>
            </div>
            <div>
              <dt>Last Checked</dt>
              <dd>{when(prompt.lastCheckedAt)}</dd>
            </div>
            <div>
              <dt>Check Frequency</dt>
              <dd>{FREQ[prompt.frequency]}</dd>
            </div>
          </dl>
        </div>
        <div className={s.tracked}>
          <small>Platforms Tracked</small>
          <div className={s.monos}>
            {prompt.platforms.map((p) => (
              <span key={p.key} className={s.mono} title={p.name}>
                {p.name.charAt(0)}
              </span>
            ))}
            {prompt.platforms.length === 0 && <span className={s.muted}>None</span>}
          </div>
        </div>
        <div className={s.credits}>
          <Coins size={24} />
          <span>
            <small>Credits per check</small>
            <b>{cost === null ? '—' : `${cost} credit${cost === 1 ? '' : 's'}`}</b>
            <Link href="/help?q=credits">How credits work?</Link>
          </span>
        </div>
      </section>

      <nav className={s.tabs} aria-label="Prompt sections">
        {PROMPT_TABS.map(([key, label]) => (
          <Link key={key} href={key === 'overview' ? base : `${base}?tab=${key}`} className={key === tab ? s.tabOn : undefined} aria-current={key === tab ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <div className={s.metrics}>
            {[
              { label: 'Avg. Visibility Score', value: num(prompt.metrics.avgVisibility), icon: <BarChart3 size={26} />, tone: 'green' },
              { label: 'Total Citations', value: num(prompt.metrics.totalCitations), icon: <FileText size={26} />, tone: 'blue' },
              { label: 'Unique Sources', value: num(prompt.metrics.uniqueSources), icon: <Users size={26} />, tone: 'purple' },
              { label: 'Trend (Last 90 days)', value: prompt.metrics.trend90d === null ? '—' : `${prompt.metrics.trend90d > 0 ? '+' : ''}${prompt.metrics.trend90d}%`, icon: <TrendingUp size={26} />, tone: 'amber' },
            ].map((m) => (
              <div key={m.label} className={s.metric}>
                <span className={s.metricIcon} data-tone={m.tone}>
                  {m.icon}
                </span>
                <span>
                  <b>{m.value}</b>
                  <small>{m.label}</small>
                </span>
              </div>
            ))}
          </div>
          <div className={s.row}>
            {trend}
            {platforms}
          </div>
          <div className={s.row2}>
            {citations}
            {opportunities}
          </div>
        </>
      )}
      {tab === 'platforms' && platforms}
      {tab === 'citations' && citations}
      {tab === 'history' && trend}
      {tab === 'competitors' && competitors}
      {tab === 'opportunities' && opportunities}
    </>
  );
}
