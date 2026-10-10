/** Admin CMS content kinds: API path segment, labels, admin routes and public URL base. */
export type CmsKind = 'blog' | 'guides' | 'help' | 'case-studies';

export const CMS_KINDS: Record<CmsKind, { noun: string; plural: string; admin: string; publicBase: string; categoryType: 'BLOG' | 'GUIDE' | 'HELP' | null }> = {
  blog: { noun: 'Blog Post', plural: 'Blog Posts', admin: '/admin/blog', publicBase: '/blog', categoryType: 'BLOG' },
  guides: { noun: 'Resource', plural: 'Resources', admin: '/admin/resources', publicBase: '/guides', categoryType: 'GUIDE' },
  help: { noun: 'Help Article', plural: 'Help Articles', admin: '/admin/help', publicBase: '/help', categoryType: 'HELP' },
  'case-studies': { noun: 'Case Study', plural: 'Case Studies', admin: '/admin/case-studies', publicBase: '/resources/case-studies', categoryType: null },
};

export type AdminArticle = {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  excerpt?: string | null;
  summary?: string | null;
  body?: string;
  seoTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  authorId?: string | null;
  author?: { id: string; displayName: string } | null;
  featuredMediaId?: string | null;
  tags?: { tag: { name: string } }[];
  customerName?: string;
  industry?: string | null;
  resultsJson?: { label: string; value: string }[] | null;
};
