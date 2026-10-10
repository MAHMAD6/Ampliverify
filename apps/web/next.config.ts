import path from 'node:path';
import type { NextConfig } from 'next';

/** Routes renamed to follow the locked navigation page map (docs/design/navigation-batch1). */
const RENAMED: [string, string][] = [
  ['/app/optimization', '/app/optimize'],
  ['/app/content-strategy', '/app/content'],
  ['/app/settings/data-privacy', '/app/settings/privacy'],
];

const dev = process.env.NODE_ENV !== 'production';

/**
 * Content Security Policy. Next.js injects inline bootstrap scripts, so
 * 'unsafe-inline' stays for scripts; everything else is same-origin. Images
 * may come from https sources (CMS and editor content). Dev adds eval for HMR.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
  "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (docker/web.Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
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
