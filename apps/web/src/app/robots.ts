import type { MetadataRoute } from 'next';

const SITE = (process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? 'https://ampliverify.com').replace(/\/$/, '');

/** Private areas (dashboards, admin, purchases, API) are never indexed (V2 guide §4.6). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app/', '/admin/', '/buyer/', '/seller/', '/api/', '/auth/', '/invite/', '/r/', '/checkout/', '/purchase/'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
