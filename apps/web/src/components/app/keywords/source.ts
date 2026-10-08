'use client';

import { apiAction } from '@/lib/actions';
import type { KeywordRow, KeywordResearch, SerpRow } from '@/lib/app-types';
import type { Intent, KeywordDetail, KeywordIdea } from './types';

export type SearchResult = { results: KeywordIdea[]; total: number; serp?: SerpRow[]; seed?: KeywordIdea | null } | null;
export type SearchError = { error: string };

const COUNTRY: Record<string, string> = { 'United States': 'US', 'United Kingdom': 'GB', Canada: 'CA', Australia: 'AU', Germany: 'DE', France: 'FR', Spain: 'ES', India: 'IN' };
const LANGUAGE: Record<string, string> = { English: 'en', Spanish: 'es', French: 'fr', German: 'de', Portuguese: 'pt', Italian: 'it' };
const TOOL: Record<string, string> = { explorer: 'EXPLORER', related: 'RELATED', questions: 'QUESTIONS', competitors: 'COMPETITOR', serp: 'SERP' };

export const countryCode = (name: string) => COUNTRY[name] ?? 'US';
export const languageCode = (name: string) => LANGUAGE[name] ?? 'en';

function toIdea(r: KeywordRow): KeywordIdea {
  const intent = r.intent ? (r.intent.toUpperCase() as Intent) : null;
  return {
    keyword: r.keyword,
    intent: intent && ['COMMERCIAL', 'TRANSACTIONAL', 'INFORMATIONAL', 'NAVIGATIONAL'].includes(intent) ? intent : null,
    volume: r.searchVolume,
    difficulty: r.difficulty === null ? null : Math.round(r.difficulty),
    cpc: r.cpc,
    trend12: r.trend ?? undefined,
    ...(r.rank !== undefined ? { relevance: r.rank } : {}),
  };
}

export type Filters = { kd: string[]; intents: string[]; volMin?: number; volMax?: number; cpcMin?: number; cpcMax?: number; include: string[]; exclude: string[] };

export function applyFilters(rows: KeywordIdea[], f: Filters) {
  return rows.filter((r) => {
    if (f.kd.length) {
      const d = r.difficulty;
      if (d === null) return false;
      const band = d <= 30 ? 'Low' : d <= 60 ? 'Medium' : 'High';
      if (!f.kd.some((k) => k.startsWith(band))) return false;
    }
    if (f.intents.length && (!r.intent || !f.intents.map((i) => i.toUpperCase()).includes(r.intent))) return false;
    if (f.volMin !== undefined && (r.volume ?? 0) < f.volMin) return false;
    if (f.volMax !== undefined && (r.volume ?? 0) > f.volMax) return false;
    if (f.cpcMin !== undefined && (r.cpc ?? 0) < f.cpcMin) return false;
    if (f.cpcMax !== undefined && (r.cpc ?? 0) > f.cpcMax) return false;
    const k = r.keyword.toLowerCase();
    if (f.include.length && !f.include.some((w) => k.includes(w.toLowerCase()))) return false;
    if (f.exclude.some((w) => k.includes(w.toLowerCase()))) return false;
    return true;
  });
}

/** Runs one research request (charged and saved to the project's history). */
export async function runResearch(projectId: string, tab: string, term: string, location: string, language: string): Promise<SearchResult | SearchError> {
  const r = await apiAction<KeywordResearch>('POST', `/user/projects/${projectId}/keywords/research`, { tool: TOOL[tab] ?? 'EXPLORER', query: term, country: countryCode(location), language: languageCode(language) }, ['/app/keywords']);
  if (!r.ok) return { error: r.message };
  const rows = (r.data.keywords ?? []).map(toIdea);
  return { results: rows, total: rows.length, serp: r.data.serp, seed: r.data.seed ? toIdea(r.data.seed) : null };
}

/** Builds the details panel from the selected row (no extra provider call). */
export function detailFor(row: KeywordIdea, related: KeywordIdea[]): KeywordDetail {
  const months = row.trend12 ?? [];
  const now = new Date();
  return {
    ...row,
    trend: months.map((volume, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months.length - 1 - i), 1);
      return { month: d.toLocaleString('en-US', { month: 'short' }), volume };
    }),
    serp: { organic: null, paid: null, featuredSnippet: null, peopleAlsoAsk: null, videos: null, localPack: null },
    relatedTopics: related.filter((r) => r.keyword !== row.keyword).slice(0, 8).map((r) => r.keyword),
  };
}

export async function saveKeywords(projectId: string, keywords: string[], location: string, language: string) {
  return apiAction('POST', `/user/projects/${projectId}/saved-keywords`, { keywords, country: countryCode(location), language: languageCode(language) }, ['/app/keywords']);
}
