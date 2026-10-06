import type { KeywordDetail, KeywordIdea } from './types';

export type SearchResult = { results: KeywordIdea[]; total: number } | null;

/**
 * Keyword data source. No keyword-data provider or API exists yet, so this
 * reports "unavailable" (null) and the UI shows its empty state. Replace the
 * bodies with calls to the project keyword API (keyword_queries /
 * keyword_metric_snapshots / serp_*) when it lands; the results table and
 * details panel already render the returned shapes.
 */
export async function searchKeywords(_projectId: string, _query: { term: string; tab: string; page: number; pageSize: number }): Promise<SearchResult> {
  return null;
}

export async function getKeywordDetail(_projectId: string, _keyword: string): Promise<KeywordDetail | null> {
  return null;
}
