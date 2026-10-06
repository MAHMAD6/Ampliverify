'use client';

import { useState } from 'react';
import {
  BarChart3,
  BookmarkPlus,
  ChevronDown,
  CircleDollarSign,
  Columns3,
  Download,
  FileSearch,
  Languages,
  ListChecks,
  MapPin,
  PieChart,
  Plus,
  Search,
  Settings2,
  Target,
  X,
} from 'lucide-react';
import { Button, DataTable, EmptyState, Field, IconCircle, Input, Metric, Notice, Panel, Select, Grid } from '@/components/ui';
import ui from '@/components/ui/ui.module.css';
import p from '../pages.module.css';
import { LANGUAGES, LOCATIONS, type FilterDef, type MetricIcon, type TabConfig } from './config';
import { KeywordDetailsPanel, KeywordResultsTable } from './KeywordResults';
import { getKeywordDetail, searchKeywords, type SearchResult } from './source';
import type { KeywordDetail } from './types';

const DEFAULT_PAGE_SIZE = 10;

/** Explorer metrics reflect the selected keyword once its details are loaded. */
function metricValue(label: string, detail: KeywordDetail | null) {
  if (!detail) return undefined;
  if (/Monthly Searches/.test(label)) return detail.volume?.toLocaleString('en-US');
  if (/Difficulty/.test(label)) return detail.difficulty ?? undefined;
  if (/CPC/.test(label)) return detail.cpc === null ? undefined : `$${detail.cpc.toFixed(2)}`;
  return undefined;
}

const METRIC_ICONS: Record<MetricIcon, { icon: React.ReactNode; tone: 'green' | 'amber' | 'purple' | 'blue' }> = {
  bars: { icon: <BarChart3 size={26} />, tone: 'green' },
  donut: { icon: <PieChart size={26} />, tone: 'amber' },
  dollar: { icon: <CircleDollarSign size={26} />, tone: 'purple' },
  target: { icon: <Target size={26} />, tone: 'blue' },
  columns: { icon: <Columns3 size={26} />, tone: 'blue' },
};

const FEATURE_ICONS = { search: <Search size={22} />, list: <ListChecks size={22} />, chart: <BarChart3 size={22} /> };

function FilterGroup({ def }: { def: FilterDef }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={p.filterGroup}>
      <button type="button" className={p.filterGroupTitle} aria-expanded={open} onClick={() => setOpen(!open)}>
        {def.title}
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && def.kind === 'checks' && (
        <div style={{ marginTop: 6 }}>
          {def.options.map((o) => (
            <label key={o} className={p.check}>
              <input type="checkbox" className={ui.checkbox} name={def.title} value={o} /> {o}
            </label>
          ))}
        </div>
      )}
      {open && def.kind === 'range' && (
        <div className={p.range}>
          <Input type="number" min={0} placeholder="Min" aria-label={`${def.title} minimum`} />
          <Input type="number" min={0} placeholder="Max" aria-label={`${def.title} maximum`} />
        </div>
      )}
      {open && def.kind === 'text' && (
        <div style={{ marginTop: 8 }}>
          <Input placeholder={def.placeholder} aria-label={def.title} />
        </div>
      )}
    </div>
  );
}

/**
 * Research workspace for one tab. No keyword-data provider is connected yet,
 * so a search never invents results: it explains why nothing is returned.
 */
export function KeywordResearch({ tab, projectId }: { tab: TabConfig; projectId: string | null }) {
  const hasProject = !!projectId;
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(!!tab.drawer);
  const [filtersKey, setFiltersKey] = useState(0);

  const [data, setData] = useState<SearchResult>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<KeywordDetail | null>(null);

  const load = async (term: string, nextPage: number, size = pageSize) => {
    setPage(nextPage);
    setData(projectId ? await searchKeywords(projectId, { term, tab: tab.key, page: nextPage, pageSize: size }) : null);
  };

  const runSearch = (value = query) => {
    if (!value.trim()) return;
    setQuery(value);
    setSearched(value.trim());
    setSelected(null);
    setDetail(null);
    void load(value.trim(), 1);
  };

  const select = async (keyword: string) => {
    setSelected(keyword);
    setDrawerOpen(true);
    setDetail(projectId ? await getKeywordDetail(projectId, keyword) : null);
  };
  const hasResults = !!data && data.results.length > 0;

  const empty = searched ? (
    <EmptyState
      icon={<FileSearch size={30} />}
      title={hasProject ? 'Keyword data is not available yet' : 'Select a project to run research'}
      description={
        hasProject
          ? `No results can be shown for “${searched}” because keyword data is not available for your account yet.`
          : 'Keyword research is saved to a project. Choose a project in the top bar, then search again.'
      }
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

  if (tab.key === 'lists') {
    return (
      <Panel
        title={tab.tableTitle}
        description="Lists are saved per project."
        bodyless
        actions={
          <Button icon={<Plus size={16} />} disabled title={hasProject ? 'Save keywords from a research tab first' : 'Select a project first'}>
            New List
          </Button>
        }
      >
        <DataTable columns={tab.columns} empty={<EmptyState icon={<ListChecks size={30} />} title={tab.emptyTitle} description={tab.emptyText} />} />
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        <form
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
                  <button type="button" aria-label="Clear" onClick={() => { setQuery(''); setSearched(null); }} style={{ position: 'absolute', right: 10, top: 11, border: 0, background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                    <X size={18} />
                  </button>
                )}
              </div>
            </Field>
            <Field label="Target location" htmlFor="kw-location">
              <div className={ui.inputIconWrap}>
                <MapPin size={18} />
                <Select id="kw-location" defaultValue={LOCATIONS[0]} style={{ paddingLeft: 38 }}>
                  {LOCATIONS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label="Language" htmlFor="kw-language">
              <div className={ui.inputIconWrap}>
                <Languages size={18} />
                <Select id="kw-language" defaultValue={LANGUAGES[0]} style={{ paddingLeft: 38 }}>
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
            <Metric key={m.label} label={m.label} info={m.info} icon={METRIC_ICONS[m.icon].icon} tone={METRIC_ICONS[m.icon].tone} value={metricValue(m.label, detail)} />
          ))}
        </Grid>
      )}

      <div className={`${p.researchLayout} ${tab.drawer && drawerOpen ? p.researchLayoutDrawer : ''}`}>
        {tab.filters && (
          <Panel key={filtersKey}>
            <div className={p.filterHead}>
              <h3>Filters</h3>
              <button type="button" onClick={() => setFiltersKey((k) => k + 1)} style={{ border: 0, background: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer' }}>
                Clear all
              </button>
            </div>
            {tab.filters.map((f) => (
              <FilterGroup key={f.title} def={f} />
            ))}
            <Button variant="outline" block disabled={!searched} style={{ marginTop: 8 }} onClick={() => runSearch()}>
              Apply Filters
            </Button>
          </Panel>
        )}

        <Panel
          title={hasResults ? `${tab.tableTitle} (${data!.total.toLocaleString('en-US')})` : tab.tableTitle}
          bodyless
          actions={
            <Button variant="secondary" size="sm" icon={<Settings2 size={16} />} disabled={!searched}>
              Columns
            </Button>
          }
        >
          {hasResults ? (
            <KeywordResultsTable
              results={data!.results}
              total={data!.total}
              page={page}
              pageSize={pageSize}
              selected={selected}
              onSelect={select}
              onPage={(n) => searched && void load(searched, n)}
              variant={tab.key === 'related' ? 'related' : 'ideas'}
              onPageSize={(n) => {
                setPageSize(n);
                if (searched) void load(searched, 1, n);
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
              <button type="button" aria-label="Close details" onClick={() => setDrawerOpen(false)} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={20} />
              </button>
            }
          >
            {detail ? <KeywordDetailsPanel detail={detail} onClose={() => setDrawerOpen(false)} /> : <>
            <EmptyState compact icon={<FileSearch size={26} />} title="No keyword selected" description="Select a keyword from the results table to view detailed insights, related terms, SERP analysis, and content opportunities." />
            <h4 style={{ fontSize: 16, marginTop: 4 }}>What you’ll see</h4>
            <div className={p.drawerList}>
              {[
                ['Keyword Overview', 'Search volume, difficulty, CPC, and trend data.'],
                ['Search Intent', 'Understand what users are looking for.'],
                ['SERP Analysis', 'Top-ranking pages and key SERP features.'],
                ['Related Keywords', 'Discover related terms and questions.'],
                ['Content Opportunities', 'Get ideas to create or optimize content.'],
              ].map(([title, text]) => (
                <div key={title} className={p.drawerItem}>
                  <IconCircle tone="blue" size={38}>
                    <BarChart3 size={18} />
                  </IconCircle>
                  <div>
                    <h4>{title}</h4>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
            </>}
          </Panel>
        )}
      </div>
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
      <Button variant="secondary" icon={<BookmarkPlus size={18} />} disabled title="Saved keywords appear here once you save some">
        Saved Keywords
      </Button>
      <Button variant="secondary" icon={<Download size={18} />} disabled title="Nothing to export yet">
        Export
      </Button>
      <Button icon={<Search size={18} />} onClick={() => document.getElementById('kw-query')?.closest('form')?.requestSubmit()}>
        Search Keywords
      </Button>
    </>
  );
}
