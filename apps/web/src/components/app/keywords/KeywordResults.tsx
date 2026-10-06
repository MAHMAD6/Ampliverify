'use client';

import { BarChart3, ChevronLeft, ChevronRight, MoreHorizontal, CircleDollarSign, MapPin, MessageCircleQuestion, MoreVertical, PencilLine, PieChart, Plus, Search, Star, Video, Bookmark } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonLink, IconCircle } from '@/components/ui';
import ui from '@/components/ui/ui.module.css';
import p from '../pages.module.css';
import { INTENT_META, difficultyTone, type KeywordDetail, type KeywordIdea } from './types';

const fmtNum = (n: number | null) => (n === null ? '—' : n.toLocaleString('en-US'));
const fmtUsd = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);

function IntentBadge({ intent, full }: { intent: KeywordIdea['intent']; full?: boolean }) {
  if (!intent) return <span>—</span>;
  const m = INTENT_META[intent];
  return (
    <span title={m.label} style={{ display: 'inline-flex', minWidth: 26, height: 24, padding: '0 8px', borderRadius: 6, alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: m.color, background: m.bg }}>
      {full ? m.label : m.letter}
    </span>
  );
}

function KdBadge({ kd }: { kd: number | null }) {
  if (kd === null) return <span>—</span>;
  const t = difficultyTone(kd);
  return <span style={{ display: 'inline-flex', minWidth: 32, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: t.color, background: t.bg }}>{kd}</span>;
}

/** Paginated results table; selecting a row opens the details panel. */
function Sparkline({ values }: { values?: number[] }) {
  if (!values || values.length < 2) return <span>—</span>;
  const max = Math.max(...values, 1);
  return (
    <svg width={values.length * 6} height={22} role="img" aria-label="12-month trend">
      {values.map((v, i) => (
        <rect key={i} x={i * 6} y={22 - (v / max) * 22} width={4} height={(v / max) * 22} rx={1} fill="var(--blue)" />
      ))}
    </svg>
  );
}

function RelevanceBar({ value }: { value?: number | null }) {
  if (value === undefined || value === null) return <span>—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <span style={{ width: 70, height: 6, borderRadius: 3, background: 'var(--blue-100)', overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${value}%`, height: '100%', background: 'var(--blue)' }} />
      </span>
      {value}%
    </span>
  );
}

export function KeywordResultsTable({
  results,
  total,
  page,
  pageSize,
  selected,
  onSelect,
  onPage,
  variant = 'ideas',
  onPageSize,
}: {
  results: KeywordIdea[];
  total: number;
  page: number;
  pageSize: number;
  selected: string | null;
  onSelect: (keyword: string) => void;
  onPage: (page: number) => void;
  variant?: 'ideas' | 'related';
  onPageSize?: (size: number) => void;
}) {
  const related = variant === 'related';
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const window = Array.from({ length: Math.min(5, pages) }, (_, i) => Math.min(Math.max(1, page - 2), Math.max(1, pages - 4)) + i);
  return (
    <>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <th>{related ? 'Related Keyword' : 'Keyword'}</th>
              <th>{related ? 'Relevance' : 'Intent'}</th>
              <th>Volume</th>
              <th>KD</th>
              <th>CPC (USD)</th>
              {related && <th>Trend (12 mo)</th>}
              {related && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.keyword} style={{ background: selected === r.keyword ? 'var(--blue-50)' : undefined, cursor: 'pointer' }} onClick={() => onSelect(r.keyword)}>
                <td>
                  <input type="checkbox" className={ui.checkbox} checked={selected === r.keyword} onChange={() => onSelect(r.keyword)} aria-label={`Select ${r.keyword}`} />
                </td>
                <td style={{ color: 'var(--blue)' }}>{r.keyword}</td>
                <td>{related ? <RelevanceBar value={r.relevance} /> : <IntentBadge intent={r.intent} />}</td>
                <td>{fmtNum(r.volume)}</td>
                <td>{related ? (r.difficulty ?? '—') : <KdBadge kd={r.difficulty} />}</td>
                <td>{related ? (r.cpc === null ? '—' : r.cpc.toFixed(2)) : fmtUsd(r.cpc)}</td>
                {related && (
                  <td>
                    <Sparkline values={r.trend12} />
                  </td>
                )}
                {related && (
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <button className={p.chip} style={{ background: 'none' }} aria-label={`Research ${r.keyword}`} onClick={() => onSelect(r.keyword)}>
                      <Search size={16} />
                    </button>
                    <button className={p.chip} style={{ background: 'none' }} aria-label={`Save ${r.keyword}`} disabled title="Saving keywords is not available yet">
                      <Bookmark size={16} />
                    </button>
                    <button className={p.chip} style={{ background: 'none' }} aria-label="More actions" disabled>
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', fontSize: 14, color: 'var(--muted)', flexWrap: 'wrap', gap: 10 }}>
        {onPageSize ? (
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            Show
            <select className={ui.select} style={{ width: 80, height: 34 }} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Results per page">
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            results · {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString('en-US')}
          </span>
        ) : (
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString('en-US')} results
          </span>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button variant="secondary" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft size={16} />
          </Button>
          {window.map((n) => (
            <Button key={n} variant={n === page ? 'primary' : 'secondary'} size="sm" onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}>
              {n}
            </Button>
          ))}
          {pages > 5 && window[window.length - 1] < pages && (
            <>
              <span>…</span>
              <Button variant="secondary" size="sm" onClick={() => onPage(pages)}>
                {pages}
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </>
  );
}

function TrendChart({ points }: { points: KeywordDetail['trend'] }) {
  if (points.length < 2) return <p style={{ fontSize: 13, color: 'var(--muted)' }}>Not enough data for a trend yet.</p>;
  const max = Math.max(...points.map((x) => x.volume), 1);
  const w = 300, h = 110, bar = w / points.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} width="100%" role="img" aria-label="Search volume over the last 12 months">
      {points.map((pt, i) => {
        const bh = (pt.volume / max) * h;
        return (
          <g key={pt.month}>
            <rect x={i * bar + 3} y={h - bh} width={bar - 6} height={bh} rx={2} fill="var(--blue)" opacity={0.55 + 0.45 * (pt.volume / max)}>
              <title>{`${pt.month}: ${pt.volume.toLocaleString('en-US')}`}</title>
            </rect>
            <text x={i * bar + bar / 2} y={h + 14} textAnchor="middle" fontSize="9" fill="var(--muted)">
              {pt.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const yesNo = (v: boolean | null) => (v === null ? '—' : v ? 'Yes' : 'No');

/** Populated "Keyword Details" panel (Overview / SERP / Related / Questions / Trend). */
export function KeywordDetailsPanel({ detail, onClose }: { detail: KeywordDetail; onClose: () => void }) {
  const [tab, setTab] = useState('Overview');
  const intent = detail.intent ? INTENT_META[detail.intent] : null;
  const showOverview = tab === 'Overview';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 24, fontWeight: 800, overflowWrap: 'anywhere' }}>{detail.keyword}</h3>
        <IntentBadge intent={detail.intent} full />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button className={p.chip} style={{ background: 'none' }} aria-label="Favorite" disabled title="Saving keywords is not available yet">
            <Star size={18} />
          </button>
          <button className={p.chip} style={{ background: 'none' }} aria-label="More" onClick={onClose}>
            <MoreVertical size={18} />
          </button>
        </span>
      </div>
      <div className={ui.tabs} style={{ marginBottom: 0 }}>
        {['Overview', 'SERP', 'Related', 'Questions', 'Trend'].map((t) => (
          <button key={t} className={`${ui.tab} ${tab === t ? ui.tabActive : ''}`} style={{ border: 0, background: 'none', padding: '10px 4px', cursor: 'pointer', fontSize: 13, minWidth: 0 }} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {(showOverview || tab === 'Trend') && (
        <>
          {showOverview && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { icon: <BarChart3 size={18} />, tone: 'green' as const, v: fmtNum(detail.volume), l: 'Monthly Searches' },
                { icon: <PieChart size={18} />, tone: 'amber' as const, v: detail.difficulty ?? '—', l: 'Keyword Difficulty' },
                { icon: <CircleDollarSign size={18} />, tone: 'purple' as const, v: fmtUsd(detail.cpc), l: 'CPC (USD)' },
              ].map((m) => (
                <div key={m.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <IconCircle tone={m.tone} size={36}>{m.icon}</IconCircle>
                  <div>
                    <strong style={{ fontSize: 18, color: 'var(--ink)' }}>{m.v}</strong>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.l}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showOverview && intent && (
            <div>
              <h4 style={{ fontSize: 15 }}>
                Search Intent <IntentBadge intent={detail.intent} full />
              </h4>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{intent.description}</p>
            </div>
          )}
          <div>
            <h4 style={{ fontSize: 15, marginBottom: 6 }}>Trend (12 months)</h4>
            <TrendChart points={detail.trend} />
          </div>
        </>
      )}
      {(showOverview || tab === 'SERP') && (
        <div>
          <h4 style={{ fontSize: 15, marginBottom: 6 }}>SERP Overview</h4>
          {[
            [<Search key="o" size={14} />, 'Organic Results', fmtNum(detail.serp.organic)],
            [<CircleDollarSign key="p" size={14} />, 'Paid Results', fmtNum(detail.serp.paid)],
            [<Star key="f" size={14} />, 'Featured Snippet', detail.serp.featuredSnippet ?? '—'],
            [<MessageCircleQuestion key="q" size={14} />, 'People Also Ask', yesNo(detail.serp.peopleAlsoAsk)],
            [<Video key="v" size={14} />, 'Videos', yesNo(detail.serp.videos)],
            [<MapPin key="l" size={14} />, 'Local Pack', yesNo(detail.serp.localPack)],
          ].map(([icon, label, value]) => (
            <div key={String(label)} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--blue)' }}>{icon}</span>
              {label}
              <span style={{ marginLeft: 'auto', color: 'var(--heading)' }}>{value}</span>
            </div>
          ))}
        </div>
      )}
      {(showOverview || tab === 'Related') && detail.relatedTopics.length > 0 && (
        <div>
          <h4 style={{ fontSize: 15, marginBottom: 8 }}>Top Related Topics</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {detail.relatedTopics.map((t) => (
              <span key={t} className={p.chip}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {tab === 'Questions' && <p style={{ fontSize: 14, color: 'var(--muted)' }}>Open the Questions tab to research questions for “{detail.keyword}”.</p>}
      <ButtonLink href="/app/content" block icon={<Plus size={18} />}>
        Create Content Strategy
      </ButtonLink>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <ButtonLink href="/app/editor" variant="outline" block icon={<PencilLine size={16} />}>
          Open in SEO Editor
        </ButtonLink>
        <Button variant="outline" block icon={<Bookmark size={16} />} disabled title="Saving keywords is not available yet">
          Save Keyword
        </Button>
      </div>
    </div>
  );
}
