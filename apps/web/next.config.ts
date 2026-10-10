import type { NextConfig } from 'next';

/** Routes renamed to follow the locked navigation page map (docs/design/navigation-batch1). */
const RENAMED: [string, string][] = [
  ['/app/optimization', '/app/optimize'],
  ['/app/content-strategy', '/app/content'],
  ['/app/settings/data-privacy', '/app/settings/privacy'],
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // The persistent Turbopack dev cache intermittently dropped the
    // /api/auth/[...all] route after restarts (404s); rebuild it each start.
    turbopackFileSystemCacheForDev: false,
  },
  async redirects() {
    return [
      ...RENAMED.flatMap(([from, to]) => [
        { source: from, destination: to, permanent: true },
        { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: true },
      ]),
      // Prompt Tracking is the AI Search (GEO) Overview's default tab (GEO design, docs/INPUTS.md #67).
      // Prompt detail pages stay at /app/geo/prompts/[id].
      { source: '/app/geo/prompts', destination: '/app/geo', permanent: false },
      // Policies live on one page (public-website-v2/11-Legal).
      { source: '/legal/privacy', destination: '/legal#privacy', permanent: true },
      { source: '/legal/terms', destination: '/legal#terms', permanent: true },
      { source: '/legal/cookies', destination: '/legal#cookies', permanent: true },
    ];
  },
};

export default nextConfig;
