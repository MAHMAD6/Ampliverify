'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { BarChart3, BookmarkPlus, ChevronDown, CircleDollarSign, Columns3, Download, FileSearch, Languages, MapPin, PieChart, Search, Target, X } from 'lucide-react';
import { Button, ButtonLink, DataTable, EmptyState, Field, IconCircle, Input, Metric, Notice, Panel, Select, Grid } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';
import ui from '@/components/ui/ui.module.css';
import p from '../pages.module.css';
import { LANGUAGES, LOCATIONS, type FilterDef, type MetricIcon, type TabConfig } from './config';
import { KeywordDetailsPanel, KeywordResultsTable } from './KeywordResults';
import { applyFilters, detailFor, runResearch, saveKeywords, type Filters, type SearchResult } from './source';
import type { KeywordIdea } from './types';

const DEFAULT_PAGE_SIZE = 10;

const METRIC_ICONS: Record<MetricIcon, { icon: React.ReactNode; tone: 'green' | 'amber' | 'purple' | 'blue' }> = {
  bars: { icon: <BarChart3 size={26} />, tone: 'green' },
  donut: { icon: <PieChart size={26} />, tone: 'amber' },
  dollar: { icon: <CircleDollarSign size={26} />, tone: 'purple' },
  target: { icon: <Target size={26} />, tone: 'blue' },
  columns: { icon: <Columns3 size={26} />, tone: 'blue' },
};

const FEATURE_ICONS = { search: <Search size={22} />, list: <BarChart3 size={22} />, chart: <BarChart3 size={22} /> };

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Summary metrics for the current result set (never invented: from returned rows only). */
function metricValue(label: string, rows: KeywordIdea[], seed: KeywordIdea | null | undefined) {
  if (!rows.length && !seed) return undefined;
  if (/^Keyword Difficulty$/.test(label) && seed?.difficulty !== null && seed?.difficulty !== undefined) return seed.difficulty;
  if (/Searches/.test(label)) {
    const a = avg(rows.map((r) => r.volume));
    return a === null ? undefined : Math.round(a).toLocaleString('en-US');
  }
  if (/Difficulty/.test(label)) {
    const a = avg(rows.map((r) => r.difficulty));
    return a === null ? undefined : Math.round(a);
  }
  if (/CPC/.test(label)) {
    const a = avg(rows.map((r) => r.cpc));
    return a === null ? undefined : `$${a.toFixed(2)}`;
  }
  if (/Keywords|Total/.test(label)) return rows.length.toLocaleString('en-US');
  return undefined;
}

function FilterGroup({ def }: { def: FilterDef }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={p.filterGroup}>
      <button type="button" className={p.filterGroupTitle} aria-expanded={open} onClick={() => setOpen(!open)}>
        {def.title}
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      <div style={{ display: open ? undefined : 'none' }}>
        {def.kind === 'checks' && (
          <div style={{ marginTop: 6 }}>
            {def.options.map((o) => (
              <label key={o} className={p.check}>
                <input type="checkbox" className={ui.checkbox} name={def.title} value={o} /> {o}
              </label>
            ))}
          </div>
        )}
        {def.kind === 'range' && (
          <div className={p.range}>
            <Input type="number" min={0} step="any" name={`${def.title}:min`} placeholder="Min" aria-label={`${def.title} minimum`} />
            <Input type="number" min={0} step="any" name={`${def.title}:max`} placeholder="Max" aria-label={`${def.title} maximum`} />
          </div>
        )}
        {def.kind === 'text' && (
          <div style={{ marginTop: 8 }}>
            <Input name={def.title} placeholder={def.placeholder} aria-label={def.title} />
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_FILTERS: Filters = { kd: [], intents: [], include: [], exclude: [] };

function readFilters(form: HTMLFormElement): Filters {
  const f = new FormData(form);
  const num = (k: string) => {
    const v = String(f.get(k) ?? '');
    return v === '' ? undefined : Number(v);
  };
  const list = (k: string) => String(f.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    kd: f.getAll('Keyword Difficulty').map(String),
    intents: f.getAll('Search Intent').map(String),
    volMin: num('Search Volume (Monthly):min'),
    volMax: num('Search Volume (Monthly):max'),
    cpcMin: num('Cost Per Click (USD):min'),
    cpcMax: num('Cost Per Click (USD):max'),
    include: list('Include Keywords'),
    exclude: list('Exclude Keywords'),
  };
}

function toCsv(rows: KeywordIdea[]) {
  const head = 'keyword,intent,volume,difficulty,cpc';
  return [head, ...rows.map((r) => [JSON.stringify(r.keyword), r.intent ?? '', r.volume ?? '', r.difficulty ?? '', r.cpc ?? ''].join(','))].join('\n');
}

/**
 * Research workspace for one tab: provider-backed results (saved to the
 * project's research history and charged per lookup), local filters and
 * pagination, details panel, saving and CSV export.
 */
export function KeywordResearch({ tab, projectId }: { tab: TabConfig; projectId: string | null }) {
  const hasProject = !!projectId;
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [searched, setSearched] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(!!tab.drawer);
  const [filtersKey, setFiltersKey] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const filterForm = useRef<HTMLFormElement>(null);

  const [data, setData] = useState<SearchResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => applyFilters(data?.results ?? [], filters), [data, filters]);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedRow = filtered.find((r) => r.keyword === selected) ?? (data?.seed?.keyword === selected ? data.seed : null);
  const detail = selectedRow ? detailFor(selectedRow, filtered) : null;

  const runSearch = (value = query) => {
    if (!value.trim()) return;
    setQuery(value);
    setSearched(value.trim());
    setSelected(null);
    setError(null);
    setNote(null);
    setPage(1);
    if (!projectId) return setData(null);
    start(async () => {
      const r = await runResearch(projectId, tab.key, value.trim(), location, language);
      if (r && 'error' in r) {
        setData(null);
        return setError(r.error);
      }
      setData(r);
      if (r?.seed) setSelected(r.seed.keyword);
    });
  };

  const save = (keywords: string[]) =>
    projectId &&
    start(async () => {
      const r = await saveKeywords(projectId, keywords, location, language);
      setNote(r.ok ? `Saved ${keywords.length} keyword${keywords.length === 1 ? '' : 's'}.` : null);
      if (!r.ok) setError(r.message);
    });

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `keywords-${(searched ?? 'export').replace(/\W+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const hasResults = filtered.length > 0;

  const empty = error ? (
    <EmptyState icon={<FileSearch size={30} />} title="Keyword research could not run" description={error} />
  ) : pending ? (
    <EmptyState icon={<FileSearch size={30} />} title="Searching…" description={`Collecting keyword data for “${searched}”.`} />
  ) : searched ? (
    <EmptyState
      icon={<FileSearch size={30} />}
      title={hasProject ? (data?.results.length ? 'No keywords match your filters' : 'No keywords found') : 'Select a project to run research'}
      description={hasProject ? (data?.results.length ? 'Clear or widen the filters.' : `The data provider returned no results for “${searched}”. Try a broader term.`) : 'Keyword research is saved to a project. Choose a project in the top bar, then search again.'}
    />
  ) : (
    <EmptyState
      icon={<FileSearch size={30} />}
      title={tab.emptyTitle}
      description={tab.emptyText}
      action={
        tab.features && (
          <div className={p.features}>
            {tab.features.map((f) => (
              <div key={f.title} className={p.feature}>
                <IconCircle tone="blue">{FEATURE_ICONS[f.icon]}</IconCircle>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        )
      }
    />
  );

  return (
    <>
      <Panel>
        <form
          id="kw-search"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <div className={p.searchCard}>
            <Field label={tab.inputLabel} htmlFor="kw-query">
              <div style={{ position: 'relative' }}>
                <Input id="kw-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab.placeholder} icon={<Search size={18} />} />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => {
                      setQuery('');
                      setSearched(null);
                      setData(null);
                    }}
                    style={{ position: 'absolute', right: 10, top: 11, border: 0, background: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </Field>
            <Field label="Target location" htmlFor="kw-location">
              <div className={ui.inputIconWrap}>
                <MapPin size={18} />
                <Select id="kw-location" value={location} onChange={(e) => setLocation(e.target.value)} style={{ paddingLeft: 38 }}>
                  {LOCATIONS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label="Language" htmlFor="kw-language">
              <div className={ui.inputIconWrap}>
                <Languages size={18} />
                <Select id="kw-language" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ paddingLeft: 38 }}>
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
            </Field>
          </div>
          {tab.examples && (
            <div className={p.examples}>
              Examples:
              {tab.examples.map((ex) => (
                <button key={ex} type="button" className={p.chip} onClick={() => runSearch(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
          <button type="submit" className="visually-hidden">
            Search Keywords
          </button>
        </form>
      </Panel>

      {tab.metrics && (
        <Grid cols={tab.metrics.length === 3 ? 3 : 4} style={{ margin: '16px 0' }}>
          {tab.metrics.map((m) => (
            <Metric key={m.label} label={m.label} info={m.info} icon={METRIC_ICONS[m.icon].icon} tone={METRIC_ICONS[m.icon].tone} value={metricValue(m.label, filtered, data?.seed)} />
          ))}
        </Grid>
      )}

      {tab.key === 'serp' ? (
        <Panel title={data?.serp?.length ? `Top Results for “${searched}”` : tab.tableTitle} bodyless>
          <DataTable
            columns={['Position', 'Title', 'Domain', 'Type']}
            rows={(data?.serp ?? []).map((r) => [
              r.position,
              <a key="t" href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
                {r.title ?? r.url}
              </a>,
              r.domain,
              r.type.replace(/_/g, ' '),
            ])}
            empty={empty}
          />
        </Panel>
      ) : (
        <div className={`${p.researchLayout} ${tab.drawer && drawerOpen ? p.researchLayoutDrawer : ''}`}>
          {tab.filters && (
            <Panel key={filtersKey}>
              <form ref={filterForm} onSubmit={(e) => e.preventDefault()}>
                <div className={p.filterHead}>
                  <h3>Filters</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltersKey((k) => k + 1);
                      setFilters(EMPTY_FILTERS);
                      setPage(1);
                    }}
                    style={{ border: 0, background: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Clear all
                  </button>
                </div>
                {tab.filters.map((f) => (
                  <FilterGroup key={f.title} def={f} />
                ))}
                <Button
                  variant="outline"
                  block
                  disabled={!data}
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    if (filterForm.current) setFilters(readFilters(filterForm.current));
                    setPage(1);
                  }}
                >
                  Apply Filters
                </Button>
              </form>
            </Panel>
          )}

          <Panel
            title={hasResults ? `${tab.tableTitle} (${filtered.length.toLocaleString('en-US')})` : tab.tableTitle}
            bodyless
            actions={
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" icon={<BookmarkPlus size={16} />} disabled={!hasResults || pending} onClick={() => save(pageRows.map((r) => r.keyword))}>
                  Save page
                </Button>
                <Button variant="secondary" size="sm" icon={<Download size={16} />} disabled={!hasResults} onClick={exportCsv}>
                  Export CSV
                </Button>
              </div>
            }
          >
            {(note || (error && hasResults)) && (
              <div style={{ padding: '8px 16px' }}>
                <ActionMessage error={hasResults ? error : null} success={note} />
              </div>
            )}
            {hasResults ? (
              <KeywordResultsTable
                results={pageRows}
                total={filtered.length}
                page={page}
                pageSize={pageSize}
                selected={selected}
                onSelect={(k) => {
                  setSelected(k);
                  setDrawerOpen(true);
                }}
                onPage={setPage}
                variant={tab.key === 'related' ? 'related' : 'ideas'}
                onPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            ) : (
              <DataTable selectable columns={tab.columns} empty={empty} />
            )}
          </Panel>

          {tab.drawer && drawerOpen && (
            <Panel
              title="Keyword Details"
              actions={
                <div style={{ display: 'flex', gap: 6 }}>
                  {detail && (
                    <Button size="sm" variant="outline" icon={<BookmarkPlus size={14} />} disabled={pending} onClick={() => save([detail.keyword])}>
                      Save
                    </Button>
                  )}
                  <button type="button" aria-label="Close details" onClick={() => setDrawerOpen(false)} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                    <X size={20} />
                  </button>
                </div>
              }
            >
              {detail ? (
                <KeywordDetailsPanel detail={detail} onClose={() => setDrawerOpen(false)} />
              ) : (
                <EmptyState compact icon={<FileSearch size={26} />} title="No keyword selected" description="Select a keyword from the results table to view volume, difficulty, intent, trend and related terms." />
              )}
            </Panel>
          )}
        </div>
      )}
      {!hasProject && !searched && (
        <div style={{ marginTop: 14 }}>
          <Notice tone="neutral">Research is saved to a project. Select a project in the top bar to keep your results.</Notice>
        </div>
      )}
    </>
  );
}

export function KeywordHeaderActions() {
  return (
    <>
      <ButtonLink href="/app/keywords/lists?saved=true" variant="secondary" icon={<BookmarkPlus size={18} />}>
        Saved Keywords
      </ButtonLink>
      <Button icon={<Search size={18} />} onClick={() => (document.getElementById('kw-search') as HTMLFormElement | null)?.requestSubmit()}>
        Search Keywords
      </Button>
    </>
  );
}
