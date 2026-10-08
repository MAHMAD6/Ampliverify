import Link from 'next/link';
import { BarChart3, Coins, Copy, FileText, Lightbulb, MessageSquareText, Pause, Pencil, Play, Settings, TrendingUp, Users } from 'lucide-react';
import { ButtonLink, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { ActionButton, ApiForm, AutoRefresh } from '@/components/ui/actions';
import type { GeoPlatformStatus, GeoPromptDetail } from '@/lib/app-types';
import { appCrumbs } from '@/lib/nav';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { TrendChart } from './TrendChart';
import s from './prompt.module.css';

export const PROMPT_TABS = [
  ['overview', 'Overview'],
  ['platforms', 'Results by Platform'],
  ['citations', 'Citations & Sources'],
  ['history', 'Visibility History'],
  ['competitors', 'Competitors'],
  ['opportunities', 'Opportunities'],
] as const;
export type PromptTab = (typeof PROMPT_TABS)[number][0];

const FREQ: Record<string, string> = { MANUAL: 'Manual', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };
const PRIORITY: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };
const RUNNING = new Set(['QUEUED', 'RUNNING']);
const when = (v: string | null) => (v ? formatDateTime(v) : '—');

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

/** Prompt Detail (chat design 2026-10-06), rendered from GET /user/geo/prompts/:id. */
export function PromptDetail({
  prompt,
  tab,
  edit,
  platforms,
  defaultPlatforms,
  creditPerPlatform,
}: {
  prompt: GeoPromptDetail;
  tab: PromptTab;
  edit: boolean;
  platforms: GeoPlatformStatus[];
  defaultPlatforms: string[];
  creditPerPlatform: number | null;
}) {
  const base = `/app/geo/prompts/${encodeURIComponent(prompt.id)}`;
  const running = !!prompt.runs[0] && RUNNING.has(prompt.runs[0].status);
  // No platforms on the prompt = the workspace defaults, else every platform (same rule as the API).
  const keys = prompt.platformKeys.length ? prompt.platformKeys : defaultPlatforms.length ? defaultPlatforms : platforms.map((p) => p.key);
  const tracked = keys.map((k) => platforms.find((p) => p.key === k) ?? { key: k, name: k, configured: false });
  const cost = creditPerPlatform === null ? null : creditPerPlatform * Math.max(tracked.filter((p) => p.configured).length, 0);
  const costLabel = cost === null ? '' : ` (${cost} credit${cost === 1 ? '' : 's'})`;
  const ok = prompt.results.filter((r) => r.status === 'SUCCEEDED');
  const allCitations = ok.flatMap((r) => r.citations.map((c) => ({ ...c, platform: r.platform.name })));
  const visibility = ok.length ? Math.round((ok.filter((r) => r.mentioned).length / ok.length) * 100) : null;
  const trendDelta = prompt.history.length >= 2 ? (prompt.history[prompt.history.length - 1].visibility ?? 0) - (prompt.history[0].visibility ?? 0) : null;
  const lastChecked = prompt.latestRun ? (prompt.latestRun.completedAt ?? prompt.latestRun.startedAt) : null;

  const runButton = (
    <ActionButton icon={<Play size={16} />} path={`/user/geo/prompts/${prompt.id}/run`} body={{}} disabled={running || prompt.status !== 'ACTIVE'} title={prompt.status !== 'ACTIVE' ? 'Resume tracking to run checks.' : undefined}>
      {running ? 'Checking…' : `Run a Check Now${costLabel}`}
    </ActionButton>
  );

  const trend = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Visibility Trend</h2>
      </header>
      {prompt.history.length >= 2 ? (
        <TrendChart title="Visibility across platforms" series={[{ name: 'All platforms', points: prompt.history.map((h) => ({ at: h.at, value: h.visibility ?? 0 })) }]} />
      ) : (
        <Empty icon={<TrendingUp size={28} />} title="No visibility trend yet" text="A trend appears after this prompt has been checked at least twice." action={runButton} />
      )}
      {tab === 'history' && prompt.runs.length > 0 && (
        <div className={s.tableWrap} style={{ marginTop: 12 }}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Started</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Visibility</th>
              </tr>
            </thead>
            <tbody>
              {prompt.runs.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.startedAt)}</td>
                  <td>{humanize(r.trigger)}</td>
                  <td>{humanize(r.status)}</td>
                  <td>{(() => {
                    const h = prompt.history.find((x) => x.runId === r.id);
                    return h?.visibility === null || h === undefined ? '—' : `${h.visibility}%`;
                  })()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const platformTable = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Platform Results</h2>
      </header>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Mentioned</th>
              <th>Position</th>
              <th>Cited</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            {tracked.map((p) => {
              const r = prompt.results.find((x) => x.platform.key === p.key);
              return (
                <tr key={p.key}>
                  <td className={s.platform}>
                    <span className={s.mono}>{p.name.charAt(0)}</span>
                    {p.name}
                  </td>
                  <td>{!r ? '—' : r.status !== 'SUCCEEDED' ? humanize(r.status) : r.mentioned ? 'Yes' : 'No'}</td>
                  <td>{r?.position ?? '—'}</td>
                  <td>{r && r.status === 'SUCCEEDED' ? (r.cited ? 'Yes' : 'No') : '—'}</td>
                  <td>{r ? r.citations.length : '—'}</td>
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

  const answers = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>AI Answers</h2>
        {lastChecked && <small className={s.muted}>Checked {formatDateTime(lastChecked)}</small>}
      </header>
      {prompt.results.length === 0 ? (
        <Empty icon={<MessageSquareText size={26} />} title="No answers yet" text="Run a check to capture each platform's answer to this prompt." action={runButton} />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {prompt.results.map((r) => (
            <details key={r.id} className={s.answer} open={prompt.results.length === 1}>
              <summary>
                <b>{r.platform.name}</b> · {r.status !== 'SUCCEEDED' ? humanize(r.status) : r.mentioned ? `Mentioned${r.position ? ` (#${r.position})` : ''}` : 'Not mentioned'}
                {r.cited ? ' · Cited' : ''}
                {r.model ? <span className={s.muted}> · {r.model}</span> : null}
              </summary>
              {r.error && <p className={s.muted}>{r.error}</p>}
              {r.excerpt && <blockquote>{r.excerpt}</blockquote>}
              {r.answer && <p className={s.answerText}>{r.answer}</p>}
              {r.citations.length > 0 && (
                <ol className={s.sources}>
                  {r.citations.map((c) => (
                    <li key={c.url}>
                      <a href={c.url} target="_blank" rel="noopener noreferrer nofollow">
                        {c.title || c.url}
                      </a>{' '}
                      <span className={s.muted}>{c.domain}</span>
                    </li>
                  ))}
                </ol>
              )}
            </details>
          ))}
        </div>
      )}
    </section>
  );

  const citations = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Top Citations</h2>
      </header>
      {allCitations.length === 0 ? (
        <Empty icon={<FileText size={26} />} title="No citations yet" text="Run a check to see the sources AI platforms cite for this prompt." />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Source</th>
                <th>Platform</th>
              </tr>
            </thead>
            <tbody>
              {allCitations.map((c, i) => (
                <tr key={`${c.url}-${c.platform}`}>
                  <td>{c.rank ?? i + 1}</td>
                  <td>
                    <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--blue)' }}>
                      {c.title || c.domain}
                    </a>
                    <span className={s.muted} style={{ display: 'block' }}>
                      {c.domain}
                    </span>
                  </td>
                  <td>{c.platform}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const opportunities = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Related Opportunities</h2>
      </header>
      {prompt.opportunities.length === 0 ? (
        <Empty icon={<Lightbulb size={26} />} title="No opportunities yet" text="Run a check to find gaps where competitors appear or other sources are cited." />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Platform</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {prompt.opportunities.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{humanize(o.type)}</b>
                    <span className={s.muted} style={{ display: 'block' }}>
                      {o.action}
                    </span>
                  </td>
                  <td>{o.platform ?? '—'}</td>
                  <td>{PRIORITY[o.priority] ?? o.priority}</td>
                  <td>
                    {o.status === 'OPEN' ? (
                      <ActionButton size="sm" variant="ghost" method="PATCH" path={`/user/geo/opportunities/${o.id}`} body={{ status: 'DONE' }}>
                        Mark Done
                      </ActionButton>
                    ) : (
                      humanize(o.status)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const rivals = ok.flatMap((r) => r.competitors.map((c) => ({ ...c, platform: r.platform.name })));
  const competitors = (
    <section className={s.panel}>
      <header className={s.head}>
        <h2>Competitors</h2>
        <Link href="/app/geo/competitors" className={s.muted}>
          Manage competitors
        </Link>
      </header>
      {rivals.length === 0 ? (
        <Empty icon={<Users size={26} />} title="No competitor mentions" text="Tracked competitors mentioned in this prompt's latest answers appear here. Add competitors on the Competitors tab." />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Competitor</th>
                <th>Platform</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {rivals.map((c) => (
                <tr key={`${c.id}-${c.platform}`}>
                  <td>{c.name}</td>
                  <td>{c.platform}</td>
                  <td>{c.position ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <>
      <AutoRefresh active={running} />
      <PageHeader
        title="Prompt Detail"
        description="View detailed results, history, and source citations for this AI search prompt."
        crumbs={appCrumbs({ label: 'AI Search (GEO)', href: '/app/geo' }, { label: 'Prompt Tracking', href: '/app/geo' }, { label: 'Prompt Detail' })}
        actions={
          <>
            <ButtonLink variant="secondary" href={edit ? base : `${base}?edit=1`} icon={<Pencil size={16} />}>
              {edit ? 'Close Editor' : 'Edit Prompt'}
            </ButtonLink>
            <ActionButton variant="secondary" icon={<Copy size={16} />} path={`/user/geo/prompts/${prompt.id}/duplicate`} body={{}} redirectTo="/app/geo/prompts/{id}">
              Duplicate
            </ActionButton>
            <ActionButton variant="secondary" icon={prompt.status === 'PAUSED' ? <Play size={16} /> : <Pause size={16} />} method="PATCH" path={`/user/geo/prompts/${prompt.id}`} body={{ status: prompt.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }}>
              {prompt.status === 'PAUSED' ? 'Resume Tracking' : 'Pause Tracking'}
            </ActionButton>
            <ActionButton variant="ghost" method="PATCH" path={`/user/geo/prompts/${prompt.id}`} body={{ status: 'ARCHIVED' }} confirm="Archive this prompt? It stops tracking and leaves the prompt list." redirectTo="/app/geo">
              Archive
            </ActionButton>
          </>
        }
      />

      {edit && (
        <section className={s.panel}>
          <header className={s.head}>
            <h2>Edit Prompt</h2>
          </header>
          <ApiForm method="PATCH" path={`/user/geo/prompts/${prompt.id}`} redirectTo={base}>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Prompt or question" htmlFor="ep-prompt">
                <Textarea id="ep-prompt" name="prompt" rows={2} required minLength={3} maxLength={500} defaultValue={prompt.prompt} />
              </Field>
              <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                <legend style={{ fontSize: 14, fontWeight: 600 }}>Platforms</legend>
                {platforms.map((p) => (
                  <label key={p.key} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                    <input type="checkbox" name="platformKeys" data-type="array" value={p.key} defaultChecked={prompt.platformKeys.includes(p.key)} disabled={!p.configured && !prompt.platformKeys.includes(p.key)} />
                    {p.name}
                  </label>
                ))}
              </fieldset>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <Field label="Check frequency" htmlFor="ep-cadence">
                  <Select id="ep-cadence" name="cadence" defaultValue={prompt.cadence}>
                    {Object.entries(FREQ).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Country" htmlFor="ep-country">
                  <Input id="ep-country" name="country" data-type="code" maxLength={2} defaultValue={prompt.country ?? ''} placeholder="US" />
                </Field>
                <Field label="Tags" htmlFor="ep-tags">
                  <Input id="ep-tags" name="tags" data-type="list" defaultValue={prompt.tags.join(', ')} />
                </Field>
              </div>
            </div>
          </ApiForm>
        </section>
      )}

      <section className={s.summary}>
        <span className={s.bigIcon}>
          <MessageSquareText size={30} />
        </span>
        <div className={s.prompt}>
          <small>Prompt</small>
          <b>{prompt.prompt}</b>
          <dl className={s.facts}>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={s.status} data-status={prompt.status}>
                  {humanize(prompt.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(prompt.createdAt)}</dd>
            </div>
            <div>
              <dt>Last Checked</dt>
              <dd>{running ? 'Checking…' : when(lastChecked)}</dd>
            </div>
            <div>
              <dt>Check Frequency</dt>
              <dd>
                {FREQ[prompt.cadence]}
                {prompt.nextRunAt && prompt.status === 'ACTIVE' ? <span className={s.muted}> · next {formatDate(prompt.nextRunAt)}</span> : null}
              </dd>
            </div>
          </dl>
        </div>
        <div className={s.tracked}>
          <small>Platforms Tracked</small>
          <div className={s.monos}>
            {tracked.map((p) => (
              <span key={p.key} className={s.mono} title={p.name}>
                {p.name.charAt(0)}
              </span>
            ))}
            {tracked.length === 0 && <span className={s.muted}>None</span>}
            {!prompt.platformKeys.length && tracked.length > 0 && <span className={s.muted}>Workspace default</span>}
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
              { label: 'Visibility Score', value: visibility === null ? '—' : `${visibility}%`, icon: <BarChart3 size={26} />, tone: 'green' },
              { label: 'Total Citations', value: allCitations.length.toLocaleString('en-US'), icon: <FileText size={26} />, tone: 'blue' },
              { label: 'Unique Sources', value: new Set(allCitations.map((c) => c.domain)).size.toLocaleString('en-US'), icon: <Users size={26} />, tone: 'purple' },
              { label: `Trend (${prompt.checks} checks)`, value: trendDelta === null ? '—' : `${trendDelta > 0 ? '+' : ''}${trendDelta} pts`, icon: <TrendingUp size={26} />, tone: 'amber' },
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
            {platformTable}
          </div>
          <div className={s.row2}>
            {citations}
            {opportunities}
          </div>
        </>
      )}
      {tab === 'platforms' && (
        <>
          {platformTable}
          {answers}
        </>
      )}
      {tab === 'citations' && citations}
      {tab === 'history' && trend}
      {tab === 'competitors' && competitors}
      {tab === 'opportunities' && opportunities}
      {(tab === 'citations' || tab === 'competitors' || tab === 'opportunities') && <div style={{ marginTop: 4 }}>{runButton}</div>}
    </>
  );
}
