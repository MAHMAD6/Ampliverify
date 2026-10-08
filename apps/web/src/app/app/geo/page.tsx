import Link from 'next/link';
import { BarChart3, ChevronRight, Coins, Copy, Eye, Lightbulb, Link2, Pause, Play, Search } from 'lucide-react';
import { Input } from '@/components/ui';
import { ActionButton, AutoRefresh } from '@/components/ui/actions';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { StateView } from '@/components/ui/StateView';
import { AddPrompt, GeoShell, GeoTable, geoPeriod, loadGeo, pct } from '@/components/app/geo/GeoShell';
import { apiGet, qs } from '@/lib/api';
import type { GeoPromptRow } from '@/lib/app-types';
import { formatDateTime } from '@/lib/format';
import s from '@/components/app/geo/geo.module.css';

export const metadata = { title: 'AI Search (GEO)' };

const FEATURES = [
  { title: 'Track your brand visibility', text: 'See if and how your content appears in AI search results.', icon: <Eye size={26} /> },
  { title: 'Monitor citations', text: 'Find out which sources are citing your brand and content.', icon: <Link2 size={26} /> },
  { title: 'Compare platforms', text: 'Track visibility across the AI search platforms you select.', icon: <BarChart3 size={26} /> },
  { title: 'Find new opportunities', text: 'Discover relevant topics and content gaps to improve visibility.', icon: <Lightbulb size={26} /> },
];

const CADENCE: Record<string, string> = { MANUAL: 'Manual', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };
const RUNNING = new Set(['QUEUED', 'RUNNING']);

type Search = { period?: string; q?: string; platform?: string; status?: string; sort?: string };

/** AI Search (GEO) Overview = Prompt Tracking tab (chat design 2026-10-06). */
export default async function GeoOverviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const period = geoPeriod(sp.period);
  const { project, platforms } = await loadGeo(period);
  const res = project ? await apiGet<GeoPromptRow[]>(`/user/projects/${project.id}/geo/prompts${qs({ q: sp.q, platform: sp.platform, status: sp.status })}`, { auth: true }) : null;
  const prompts = [...(res?.ok ? res.data : [])];
  const sort = sp.sort ?? 'updated';
  const checked = (p: GeoPromptRow) => (p.lastRun ? Date.parse(p.lastRun.completedAt ?? p.lastRun.startedAt) : Date.parse(p.createdAt));
  const cited = (p: GeoPromptRow) => p.platforms.filter((x) => x.cited).length;
  prompts.sort((a, b) => (sort === 'visibility' ? (b.visibility ?? -1) - (a.visibility ?? -1) : sort === 'citations' ? cited(b) - cited(a) : checked(b) - checked(a)));
  const filtered = !!(sp.q || sp.platform || sp.status);

  return (
    <GeoShell tab="prompts" period={period}>
      <AutoRefresh active={prompts.some((p) => p.lastRun && RUNNING.has(p.lastRun.status))} />
      <form className={s.filters} role="search">
        <input type="hidden" name="period" value={period} />
        <Input name="q" defaultValue={sp.q ?? ''} placeholder="Search prompts (e.g. “best dog food brands”)" icon={<Search size={18} />} aria-label="Search prompts" />
        <AutoSubmitSelect name="platform" aria-label="Platform" defaultValue={sp.platform ?? ''}>
          <option value="">All Platforms</option>
          {platforms.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="status" aria-label="Status" defaultValue={sp.status ?? ''}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
        </AutoSubmitSelect>
        <AutoSubmitSelect name="sort" aria-label="Sort" defaultValue={sort}>
          <option value="updated">Last Updated</option>
          <option value="visibility">Visibility Score</option>
          <option value="citations">Citations</option>
        </AutoSubmitSelect>
      </form>
      <GeoTable
        columns={['Prompt', 'Platforms', 'Visibility Score', 'Avg. Position', 'Cited', 'Last Checked', 'Actions']}
        rows={prompts.map((p) => [
          <span key="p">
            <Link className={s.promptLink} href={`/app/geo/prompts/${p.id}`}>
              {p.prompt}
            </Link>
            <span className={s.sub}>
              {CADENCE[p.cadence]}
              {p.country ? ` · ${p.country}` : ''}
              {p.tags.length ? ` · ${p.tags.join(', ')}` : ''}
              {p.status === 'PAUSED' ? ' · Paused' : ''}
            </span>
          </span>,
          <span key="pl" className={s.chips}>
            {!p.platforms.length && !p.platformKeys.length && <span className={s.chip}>Workspace default</span>}
            {(p.platforms.length ? p.platforms : p.platformKeys.map((k) => ({ key: k, name: platforms.find((x) => x.key === k)?.name ?? k, status: 'PENDING', mentioned: false, cited: false, position: null }))).map((x) => (
              <span key={x.key} className={s.chip} data-on={x.mentioned} data-state={x.status === 'FAILED' ? 'fail' : undefined} title={x.status === 'FAILED' ? 'Check failed' : x.mentioned ? 'Brand mentioned' : 'Not mentioned'}>
                {x.name}
              </span>
            ))}
          </span>,
          pct(p.visibility),
          p.avgPosition ?? '—',
          p.platforms.length ? `${cited(p)}/${p.platforms.length}` : '—',
          p.lastRun ? (RUNNING.has(p.lastRun.status) ? 'Checking…' : formatDateTime(p.lastRun.completedAt ?? p.lastRun.startedAt)) : 'Never',
          <span key="a" className={s.rowActions}>
            <ActionButton size="sm" variant="outline" icon={<Play size={14} />} path={`/user/geo/prompts/${p.id}/run`} body={{}} disabled={p.status !== 'ACTIVE' || (!!p.lastRun && RUNNING.has(p.lastRun.status))}>
              Run
            </ActionButton>
            <ActionButton size="sm" variant="ghost" icon={p.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />} method="PATCH" path={`/user/geo/prompts/${p.id}`} body={{ status: p.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }}>
              {p.status === 'PAUSED' ? 'Resume' : 'Pause'}
            </ActionButton>
            <ActionButton size="sm" variant="ghost" icon={<Copy size={14} />} path={`/user/geo/prompts/${p.id}/duplicate`} body={{}}>
              Duplicate
            </ActionButton>
          </span>,
        ])}
        empty={
          filtered ? (
            <StateView kind="empty" compact icon={<Search size={28} />} title="No prompts match" description="Try another search or clear the filters." />
          ) : (
            <StateView
              kind="empty"
              icon={<Search size={40} />}
              title="Start tracking your AI search visibility"
              description="Add a prompt or question to see how your brand and content appear in AI-generated search results across different platforms."
              action={<AddPrompt period={period} label="Add Your First Prompt" />}
            />
          )
        }
      />
      <div className={s.credits}>
        <Coins size={30} />
        <span>
          <b>This feature uses credits.</b>
          <small>Each prompt check consumes credits based on the selected platforms.</small>
        </span>
        <Link href="/help?q=credits">
          Learn more <ChevronRight size={16} />
        </Link>
      </div>
      {prompts.length === 0 && !filtered && (
        <div className={s.features}>
          {FEATURES.map((f) => (
            <div key={f.title} className={s.feature}>
              <span className={s.featureIcon}>{f.icon}</span>
              <span>
                <b>{f.title}</b>
                <small>{f.text}</small>
              </span>
            </div>
          ))}
        </div>
      )}
    </GeoShell>
  );
}
