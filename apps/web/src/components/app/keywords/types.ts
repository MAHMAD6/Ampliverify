/** Shape the keyword-data API will return (keywords + keyword_metric_snapshots + serp_*). */
export type Intent = 'COMMERCIAL' | 'TRANSACTIONAL' | 'INFORMATIONAL' | 'NAVIGATIONAL';

export type KeywordIdea = {
  keyword: string;
  intent: Intent | null;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  /** Related Keywords tab: similarity to the seed term, 0–100. */
  relevance?: number | null;
  /** Monthly volumes for the sparkline, oldest first. */
  trend12?: number[];
};

export type KeywordDetail = KeywordIdea & {
  /** Monthly search volume, oldest first (up to 12 points). */
  trend: { month: string; volume: number }[];
  serp: { organic: number | null; paid: number | null; featuredSnippet: 'Yes' | 'No' | 'Possible' | null; peopleAlsoAsk: boolean | null; videos: boolean | null; localPack: boolean | null };
  relatedTopics: string[];
};

export const INTENT_META: Record<Intent, { letter: string; label: string; description: string; color: string; bg: string }> = {
  COMMERCIAL: { letter: 'C', label: 'Commercial', description: 'Users are comparing products or looking to make a purchase.', color: '#b45309', bg: '#fff3dc' },
  TRANSACTIONAL: { letter: 'T', label: 'Transactional', description: 'Users are ready to buy or complete an action.', color: '#15803d', bg: '#e3f6e9' },
  INFORMATIONAL: { letter: 'I', label: 'Informational', description: 'Users are looking for information or answers.', color: '#1d4ed8', bg: '#e6eeff' },
  NAVIGATIONAL: { letter: 'N', label: 'Navigational', description: 'Users are looking for a specific site or page.', color: '#7c3aed', bg: '#f1e9ff' },
};

/** Difficulty bands match the Keyword Difficulty filter: Low 0–30, Medium 31–60, High 61–100. */
export function difficultyTone(kd: number) {
  if (kd <= 30) return { color: '#15803d', bg: '#e3f6e9' };
  if (kd <= 60) return { color: '#b45309', bg: '#fff3dc' };
  return { color: '#b91c1c', bg: '#fde8e8' };
}
