/** Shapes returned by apps/api. Keep in sync with the API services. */

export type Category = { name: string; slug: string } | null;

export type ContentSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string;
  updatedAt?: string;
  category: Category;
  author?: { displayName: string; slug: string } | null;
};

export type ContentDetail = ContentSummary & {
  seoTitle: string | null;
  metaDescription: string | null;
  body: string | null;
  tags?: { name: string; slug: string }[];
  author?: { displayName: string; slug: string; bio: string | null } | null;
};

export type JobSummary = {
  slug: string;
  title: string;
  department: string | null;
  locationText: string | null;
  employmentType: string;
  workArrangement: 'REMOTE' | 'HYBRID' | 'ON_SITE' | null;
  compensationText: string | null;
  summary: string | null;
  applicationDeadline: string | null;
  requireResume: boolean;
  requireCoverLetter: boolean;
  publishedAt: string;
};

export type JobDetail = JobSummary & {
  seoTitle: string | null;
  metaDescription: string | null;
  description: string | null;
};

export type PublicPlan = {
  code: string;
  name: string;
  description: string | null;
  prices: { billingInterval: 'MONTHLY' | 'ANNUAL'; currency: string; amountMinor: string }[];
  entitlements: {
    enabled: boolean;
    limitNumeric: string | null;
    feature: { key: string; name: string; valueType: 'BOOLEAN' | 'LIMIT' | 'CONFIG'; moduleKey: string | null };
  }[];
};

export type IntegrationProvider = { key: string; name: string; authType: string };

export type Me = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  createdAt: string;
};

export type Project = {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  /** Present on list responses: first domain added to the project. */
  primaryDomain?: string | null;
};
