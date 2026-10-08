/** Response shapes of the product APIs (apps/api). Keep in sync with the services. */

export type Scores = { overall: number; technical: number; seo: number; content: number; geo: number };
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type FindingStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED' | 'REGRESSED';
export type AuditCategory = 'TECHNICAL' | 'SEO' | 'CONTENT' | 'GEO';

export type Finding = {
  id: string;
  ruleKey: string;
  severity: Severity;
  status: FindingStatus;
  category: AuditCategory;
  categoryLabel: string;
  priority: 1 | 2 | 3;
  title: string;
  why: string | null;
  guidance: string | null;
  details: Record<string, unknown>;
  pageUrl: string;
  createdAt: string;
  task: { id: string; status: string; assignedTo?: string | null } | null;
};

export type AuditRunView = {
  id: string;
  projectId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  trigger: string;
  startedAt: string;
  completedAt: string | null;
  request: { url: string; scope: 'PAGE' | 'SITE'; mode: 'SEO' | 'GEO' | 'BOTH'; maxPages: number } | null;
  scores: Scores | null;
  counts: Record<Severity, number> | null;
  pagesCrawled: number | null;
  page: { url: string; status: number; title: string | null; metaDescription: string | null; h1: string | null; wordCount: number; responseTimeMs: number } | null;
  site: { robotsFound: boolean; sitemapFound: boolean } | null;
  error: string | null;
};

export type AuditDetail = AuditRunView & {
  pages: { id: string; url: string; score: number | null; metrics: Record<string, unknown>; findings: Finding[] }[];
};

export type Recommendations = {
  summary: { high: number; medium: number; low: number; verified: number; resolved: number; lastAnalyzedAt: string | null; lastRunId: string | null; pages: string[] };
  items: Finding[];
};

export type TaskView = {
  id: string;
  projectId: string;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'DISMISSED';
  priority: number;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; email: string; displayName: string | null } | null;
  finding: Finding | null;
  verifications: { id: string; status: string; result: string | null; createdAt: string; auditRunId: string | null }[];
};

export type Member = { userId: string; email: string; displayName: string | null; status: string; joinedAt: string; role: 'OWNER' | 'MEMBER'; roles: { key: string; name: string; scope: string }[] };

export type WorkspaceView = {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  language: string;
  settings: {
    aiGeo?: { defaultPlatforms?: string[]; defaultCountry?: string; defaultLanguage?: string; brandName?: string; brandAliases?: string[]; competitors?: string[]; checkFrequency?: string; aiTone?: string; aiCreativity?: string; autoApplySuggestions?: boolean; monthlyCreditCap?: number | null };
    privacy?: { retentionDays?: number | null; allowPublicReportShares?: boolean; shareLinkExpiryDays?: number };
    projectDefaults?: { crawlScope?: string; maxPages?: number; auditMode?: string; auditFrequency?: string; reportFrequency?: string };
  };
  createdAt: string;
  organization: { id: string; name: string; slug: string } | null;
  projectCount: number;
  memberCount: number;
  permissions: { update: boolean; manageMembers: boolean };
};

export type BillingOverview = {
  plan: { code: string | null; name: string | null };
  subscription: { id: string; status: string; currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean; interval: 'MONTHLY' | 'ANNUAL' | null; amountMinor: string | null; currency: string | null } | null;
  periodStart: string;
  periodEnd: string | null;
  credits: { balance: string; lowThreshold: number; low: boolean };
  usage: { featureKey: string; units: number }[];
  limits: { featureKey: string; limit: number | null }[];
  features: { featureKey: string; enabled: boolean; limit: number | null }[] | null;
  creditPacks: { code: string; name?: string; credits: number; amountMinor: number; currency: string }[];
  creditCosts: Record<string, number>;
  paymentsEnabled: boolean;
};

export type LedgerEntry = { id: string; delta: string; reason: string; referenceType: string | null; referenceId: string | null; createdAt: string };

export type Invoice = { id: string; status: string; currency: string; totalMinor: string; issuedAt: string | null; createdAt: string; providerInvoiceId: string; lines: { id: string; description: string; amountMinor: string; quantity: string | null }[] };

export type NotificationItem = { id: string; workspaceId: string; eventKey: string; title: string; body: string; readAt: string | null; createdAt: string };

export type GeoPlatformStatus = { id: string; key: string; name: string; provider: string; configured: boolean };

export type GeoMetrics = { answers: number; citations: number; lastCheckedAt: string | null; visibility: number | null; citationRate: number | null; avgPosition: number | null; shareOfVoice: number | null };

export type GeoOverview = GeoMetrics & {
  periodDays: number;
  lastCheckedAt: string | null;
  prompts: number;
  checks: number;
  openOpportunities: number;
  platforms: (GeoPlatformStatus & GeoMetrics)[];
  trend: { day: string; platformKey: string | null; visibility: number }[];
};

export type GeoPromptRow = {
  id: string;
  prompt: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  tags: string[];
  country: string | null;
  platformKeys: string[];
  cadence: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  nextRunAt: string | null;
  createdAt: string;
  lastRun: { id: string; status: string; startedAt: string; completedAt: string | null } | null;
  platforms: { key: string; name: string; status: string; mentioned: boolean; cited: boolean; position: number | null }[];
  visibility: number | null;
  avgPosition: number | null;
};

export type GeoPromptDetail = Omit<GeoPromptRow, 'lastRun' | 'platforms' | 'visibility' | 'avgPosition'> & {
  projectId: string;
  latestRun: { id: string; status: string; startedAt: string; completedAt: string | null; creditCost: string | null } | null;
  results: {
    id: string;
    platform: { key: string; name: string };
    status: string;
    answer: string | null;
    model: string | null;
    error: string | null;
    mentioned: boolean;
    position: number | null;
    cited: boolean;
    excerpt: string | null;
    citations: { rank: number | null; url: string; domain: string; title: string | null }[];
    competitors: { id: string; name: string; position: number | null }[];
  }[];
  history: { runId: string; at: string; visibility: number | null; platforms: number }[];
  checks: number;
  opportunities: GeoOpportunity[];
  runs: { id: string; status: string; trigger: string; startedAt: string; completedAt: string | null }[];
};

export type GeoOpportunity = { id: string; type: string; priority: number; status: string; runId: string | null; createdAt: string; platform?: string; prompt?: string; action?: string; sources?: string[]; competitors?: string[]; domain?: string };

export type KeywordRow = { keyword: string; searchVolume: number | null; difficulty: number | null; cpc: number | null; competition: string | null; intent: string | null; trend: number[] | null; rank?: number | null; url?: string | null };
export type SerpRow = { position: number; url: string; domain: string; title: string | null; type: string };
export type KeywordResearch = { id: string; query: string; tool: string; country: string; language: string; createdAt: string; keywords?: KeywordRow[]; seed?: KeywordRow | null; serp?: SerpRow[] };

export type ReportRow = {
  id: string;
  projectId: string;
  type: string;
  status: string;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  project: { id: string; name: string };
  creator: { displayName: string | null; email: string } | null;
  files: { format: string; sizeBytes: string }[];
  shares: { id: string; expiresAt: string | null }[];
};

export type ProjectSummary = {
  project: { id: string; name: string; status: string };
  audit: { id: string; completedAt: string | null; scores: Scores | null; pagesCrawled: number | null; url: string | null } | null;
  audits: number;
  issues: { critical: number; high: number; medium: number; low: number; total: number };
  tasks: { open: number; done: number; verified: number };
  geo: { visibility: number | null; citationRate: number | null; avgPosition: number | null; prompts: number; lastCheckedAt: string | null; trend: { day: string; visibility: number }[] };
  keywords: { lists: number; tracked: number };
  content: { ideas: number; briefs: number; documents: number };
  reports: number;
  activity: { id: string; eventType: string; targetType: string; targetId: string | null; createdAt: string }[];
};
