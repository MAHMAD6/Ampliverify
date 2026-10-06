/**
 * Per-tab configuration for Keyword Research, taken from the approved
 * Keyword Explorer / Questions / Competitor Keywords / SERP Analysis designs.
 * Related Keywords and Keyword Lists follow the same pattern (no dedicated design yet).
 */
export type TabKey = 'explorer' | 'related' | 'questions' | 'competitors' | 'serp' | 'lists';
export type MetricIcon = 'bars' | 'donut' | 'dollar' | 'target' | 'columns';
export type FilterDef =
  | { kind: 'checks'; title: string; options: string[] }
  | { kind: 'range'; title: string }
  | { kind: 'text'; title: string; placeholder: string };

export type TabConfig = {
  key: TabKey;
  label: string;
  href: string;
  inputLabel?: string;
  placeholder?: string;
  examples?: string[];
  metrics?: { label: string; icon: MetricIcon; info: string }[];
  filters?: FilterDef[];
  tableTitle: string;
  columns: string[];
  emptyTitle: string;
  emptyText: string;
  features?: { icon: 'search' | 'list' | 'chart'; title: string; text: string }[];
  drawer?: boolean;
};

const KD: FilterDef = { kind: 'checks', title: 'Keyword Difficulty', options: ['Low (0–30)', 'Medium (31–60)', 'High (61–100)'] };
const VOLUME: FilterDef = { kind: 'range', title: 'Search Volume (Monthly)' };
const CPC: FilterDef = { kind: 'range', title: 'Cost Per Click (USD)' };
const INTENT: FilterDef = { kind: 'checks', title: 'Search Intent', options: ['Informational', 'Commercial', 'Transactional', 'Navigational'] };
const INCLUDE: FilterDef = { kind: 'text', title: 'Include Keywords', placeholder: 'Add keywords (comma separated)' };
const EXCLUDE: FilterDef = { kind: 'text', title: 'Exclude Keywords', placeholder: 'Add keywords (comma separated)' };

const AVG_SEARCHES = { label: 'Avg. Monthly Searches', icon: 'bars' as const, info: 'Average monthly search volume across results.' };
const AVG_KD = { label: 'Avg. Keyword Difficulty', icon: 'donut' as const, info: 'How hard it is to rank, from 0 to 100.' };
const AVG_CPC = { label: 'Avg. CPC (USD)', icon: 'dollar' as const, info: 'Average cost per click for paid search.' };

export const TABS: TabConfig[] = [
  {
    key: 'explorer',
    label: 'Keyword Explorer',
    href: '/app/keywords',
    inputLabel: 'Enter a keyword or topic',
    placeholder: 'Enter a keyword or topic (e.g. dog food, pet care, dog training)',
    examples: ['dog food', 'puppy training', 'pet insurance', 'organic dog food', 'best cat litter'],
    metrics: [AVG_SEARCHES, { ...AVG_KD, label: 'Keyword Difficulty' }, AVG_CPC],
    filters: [KD, VOLUME, CPC, INTENT, INCLUDE, EXCLUDE],
    tableTitle: 'Keyword Ideas',
    columns: ['Keyword', 'Intent', 'Volume', 'KD', 'CPC (USD)', 'Actions'],
    emptyTitle: 'Find keyword opportunities',
    emptyText: 'Enter a keyword or topic above and click “Search Keywords” to see keyword ideas, search volume, competition, and more.',
    features: [
      { icon: 'search', title: 'Discover ideas', text: 'Find relevant keywords for your content.' },
      { icon: 'list', title: 'Analyze intent', text: 'Understand what your audience is searching for.' },
      { icon: 'chart', title: 'Check competition', text: 'See search volume, difficulty, and CPC.' },
    ],
    drawer: true,
  },
  {
    key: 'related',
    label: 'Related Keywords',
    href: '/app/keywords/related',
    inputLabel: 'Enter a keyword or topic',
    placeholder: 'Enter a seed keyword (e.g. dog food)',
    examples: ['dog food', 'pet care', 'dog training'],
    metrics: [{ label: 'Related Keywords', icon: 'bars', info: 'Number of related terms found.' }, AVG_SEARCHES, AVG_KD, AVG_CPC],
    filters: [KD, VOLUME, CPC, INTENT, INCLUDE, EXCLUDE],
    tableTitle: 'Related Keywords',
    columns: ['Keyword', 'Relevance', 'Volume', 'KD', 'CPC (USD)', 'Trend (12 mo)', 'Actions'],
    emptyTitle: 'Find related keywords',
    emptyText: 'Enter a seed keyword above and click “Search Keywords” to discover semantically related terms and variations.',
    features: [
      { icon: 'search', title: 'Expand your topic', text: 'Find variations and closely related terms.' },
      { icon: 'list', title: 'Group by relevance', text: 'See how closely each term matches your seed.' },
      { icon: 'chart', title: 'Prioritize', text: 'Use volume, difficulty, and intent to choose targets.' },
    ],
  },
  {
    key: 'questions',
    label: 'Questions',
    href: '/app/keywords/questions',
    inputLabel: 'Enter a keyword or topic',
    placeholder: 'Enter a keyword or topic (e.g. what is seo, how to rank higher)',
    examples: ['what is seo', 'how to rank higher', 'best dog food', 'content strategy'],
    metrics: [{ label: 'Questions Found', icon: 'bars', info: 'Number of question-based queries found.' }, { ...AVG_SEARCHES, icon: 'donut' }, { ...AVG_KD, icon: 'columns' }, AVG_CPC],
    filters: [INTENT, KD, VOLUME, CPC, INCLUDE, EXCLUDE],
    tableTitle: 'Question Ideas',
    columns: ['Question Keyword', 'Intent', 'Volume', 'KD', 'CPC (USD)', 'Trend (12 mo)', 'Actions'],
    emptyTitle: 'Find search questions',
    emptyText: 'Enter a keyword or topic above and click “Search Keywords” to discover question-based queries your audience is asking.',
    features: [
      { icon: 'search', title: 'Uncover questions', text: 'Find real questions people are asking related to your topic.' },
      { icon: 'list', title: 'See search demand', text: 'Analyze volume, difficulty, CPC, and trends.' },
      { icon: 'chart', title: 'Plan content', text: 'Identify opportunities to create helpful content.' },
    ],
  },
  {
    key: 'competitors',
    label: 'Competitor Keywords',
    href: '/app/keywords/competitors',
    inputLabel: 'Enter a domain or competitor',
    placeholder: 'Enter a domain (e.g. example.com) or click a suggested competitor',
    examples: ['chewy.com', 'petsmart.com', 'petco.com', 'barkbox.com', 'rover.com'],
    metrics: [{ label: 'Competitor Keywords', icon: 'bars', info: 'Keywords the competitor ranks for.' }, AVG_KD, AVG_CPC, { label: 'Competitor Visibility', icon: 'target', info: 'Estimated share of search visibility.' }],
    filters: [KD, VOLUME, CPC, INTENT],
    tableTitle: 'Competitor Keywords',
    columns: ['Keyword', 'Position (Comp.)', 'Search Volume', 'KD', 'CPC (USD)', 'Trend (12 mo)', 'Actions'],
    emptyTitle: 'Find competitor keywords',
    emptyText: 'Enter a competitor’s domain above and click “Search Keywords” to see the keywords they rank for, along with search volume, difficulty, CPC, and position.',
    features: [
      { icon: 'search', title: 'Analyze competitors', text: 'See the keywords your competitors rank for in search results.' },
      { icon: 'list', title: 'Find opportunities', text: 'Identify keyword gaps to create new content.' },
      { icon: 'chart', title: 'Filter and prioritize', text: 'Use volume, difficulty, and intent to find the best opportunities.' },
    ],
  },
  {
    key: 'serp',
    label: 'SERP Analysis',
    href: '/app/keywords/serp',
    inputLabel: 'Enter a keyword or topic',
    placeholder: 'Enter a keyword or topic (e.g. dog food, pet care, dog training)',
    examples: ['dog food', 'puppy training', 'pet insurance', 'organic dog food', 'best dog food brands'],
    metrics: [
      { label: 'SERP Results', icon: 'bars', info: 'Results returned for the keyword.' },
      { label: 'Avg. Domain Authority', icon: 'donut', info: 'Average authority of ranking domains.' },
      { label: 'Avg. Content Length', icon: 'dollar', info: 'Average word count of ranking pages.' },
      { label: 'Featured Snippet', icon: 'target', info: 'Whether a featured snippet is shown.' },
    ],
    filters: [
      { kind: 'checks', title: 'Result Type', options: ['All Results', 'Organic Results', 'Paid Results', 'SERP Features'] },
      { kind: 'checks', title: 'SERP Features', options: ['Featured Snippet', 'People Also Ask', 'Sitelinks', 'Videos', 'Images', 'Top Stories', 'Local Pack'] },
      VOLUME,
    ],
    tableTitle: 'SERP Analysis Results',
    columns: ['#', 'Search Result', 'Type', 'Domain Authority', 'Est. Traffic', 'Keywords', 'Actions'],
    emptyTitle: 'Analyze search results (SERP)',
    emptyText: 'Enter a keyword or topic above and click “Search Keywords” to see the top search results, SERP features, domain authority, content length, and keyword opportunities.',
    features: [
      { icon: 'search', title: 'See top results', text: 'Analyze the top-ranking pages for your keyword.' },
      { icon: 'list', title: 'Identify SERP features', text: 'Find featured snippets, People Also Ask, videos, and more.' },
      { icon: 'chart', title: 'Find content opportunities', text: 'Discover what type of content ranks and optimize your strategy.' },
    ],
  },
  {
    key: 'lists',
    label: 'Keyword Lists',
    href: '/app/keywords/lists',
    tableTitle: 'Keyword Lists',
    columns: ['List', 'Keywords', 'Created', 'Actions'],
    emptyTitle: 'No keyword lists yet',
    emptyText: 'Save keywords from any research tab to build lists you can reuse in content planning.',
  },
];

export const LOCATIONS = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'India'];
export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian'];
