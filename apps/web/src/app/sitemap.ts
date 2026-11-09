import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api';
import type { BrowsePage } from '@/lib/marketplace';

const SITE = (process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? 'https://ampliverify.com').replace(/\/$/, '');

const STATIC = [
  '/', '/features', '/how-it-works', '/pricing', '/about', '/contact', '/careers', '/blog', '/guides', '/help',
  '/seo-audit', '/seo-editor', '/geo-ai-search', '/content-audit', '/website-value',
  '/asset-tools', '/asset-tools/asset-overview', '/asset-tools/acquisition-analysis', '/asset-tools/asset-optimization', '/asset-tools/valuation-performance',
  '/marketplace', '/marketplace/listings', '/marketplace/how-it-works', '/marketplace/faq', '/sell',
  '/privacy', '/terms', '/cookies', '/dpa', '/digital-product-refund-policy', '/seller-guidelines', '/regional-disclosures',
];

export const revalidate = 3600;

/** Public pages plus the first pages of published Marketplace listings. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = STATIC.map((p) => ({ url: `${SITE}${p}`, changeFrequency: 'weekly', priority: p === '/' ? 1 : 0.6 }));
  for (let page = 1; page <= 5; page++) {
    const res = await apiGet<BrowsePage>(`/public/marketplace/listings?page=${page}`, { revalidate: 3600 });
    if (!res.ok) break;
    for (const l of res.data.items) pages.push({ url: `${SITE}/marketplace/listings/${encodeURIComponent(l.slug ?? l.id)}`, lastModified: l.publishedAt ?? undefined, changeFrequency: 'weekly', priority: 0.5 });
    if (page * res.data.pageSize >= res.data.total) break;
  }
  return pages;
}
