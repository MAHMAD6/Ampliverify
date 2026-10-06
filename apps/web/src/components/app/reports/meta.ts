/** Mirrors the API's report_type and run_status enums. */
export const REPORT_TYPES = [
  ['SEO_AUDIT', 'SEO Report'],
  ['CONTENT', 'Content Strategy Report'],
  ['GEO_VISIBILITY', 'AI Search (GEO) Report'],
  ['KEYWORD', 'Keyword Report'],
  ['EXECUTIVE_SUMMARY', 'Executive Summary'],
  ['CUSTOM', 'Custom Report'],
] as const;

export const REPORT_STATUSES = [
  ['QUEUED', 'Queued'],
  ['RUNNING', 'Generating'],
  ['SUCCEEDED', 'Ready'],
  ['FAILED', 'Failed'],
  ['CANCELED', 'Canceled'],
] as const;

export type Report = {
  id: string;
  projectId: string;
  title: string;
  type: (typeof REPORT_TYPES)[number][0];
  status: (typeof REPORT_STATUSES)[number][0];
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  domain?: string | null;
  projectName?: string | null;
  pagesAnalyzed?: number | null;
};
