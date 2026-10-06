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
  async redirects() {
    return RENAMED.flatMap(([from, to]) => [
      { source: from, destination: to, permanent: true },
      { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: true },
    ]);
  },
};

export default nextConfig;
