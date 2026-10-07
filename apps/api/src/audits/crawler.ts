import { analyzePage, PageAnalysis, RawFinding } from './analyzer';
import { isAllowed, parseRobots, RobotsRules } from './robots';
import { safeFetch, SafeFetchError } from '../common/utils/safe-fetch';

export type CrawlRequest = {
  startUrl: string;
  scope: 'PAGE' | 'SITE';
  maxPages: number;
  allowPrivate?: boolean;
  /** Upper bound on extra link-status checks. */
  maxLinkChecks?: number;
};

export type CrawledPage = PageAnalysis & { url: string };

export type CrawlResult = {
  pages: CrawledPage[];
  site: { robotsFound: boolean; sitemapFound: boolean; sitemaps: string[] };
  errors: { url: string; error: string }[];
};

function normalize(url: string) {
  const u = new URL(url);
  u.hash = '';
  if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString();
}

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|gz|mp4|mp3|woff2?|ttf|css|js|xml|json|txt)$/i;

/**
 * Fetches pages through `safeFetch` (SSRF-guarded), honours robots.txt,
 * analyses each page, then adds site-level findings: duplicate titles /
 * descriptions / content, broken and redirected internal links, missing
 * robots.txt or sitemap.
 */
export async function crawl(req: CrawlRequest): Promise<CrawlResult> {
  const start = new URL(req.startUrl);
  const origin = start.origin;
  const fetchOpts = { allowPrivate: req.allowPrivate, timeoutMs: 15000 };
  const errors: CrawlResult['errors'] = [];

  // robots.txt + sitemap discovery
  let robots: RobotsRules = { groups: [], sitemaps: [] };
  let robotsFound = false;
  try {
    const res = await safeFetch(`${origin}/robots.txt`, { ...fetchOpts, maxBytes: 512 * 1024 });
    if (res.status === 200 && !/html/i.test(res.headers['content-type'] ?? '')) {
      robots = parseRobots(res.body);
      robotsFound = true;
    }
  } catch {
    // treated as "no robots.txt"
  }
  const sitemapCandidates = robots.sitemaps.length ? robots.sitemaps.slice(0, 3) : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  let sitemapFound = false;
  for (const candidate of sitemapCandidates) {
    try {
      const res = await safeFetch(candidate, { ...fetchOpts, maxBytes: 2 * 1024 * 1024 });
      if (res.status === 200 && /<(urlset|sitemapindex)\b/i.test(res.body)) {
        sitemapFound = true;
        break;
      }
    } catch {
      // try the next candidate
    }
  }

  const pages: CrawledPage[] = [];
  const statusByUrl = new Map<string, { status: number; redirected: boolean }>();
  const seen = new Set<string>();
  const queue = [normalize(start.toString())];
  const limit = req.scope === 'PAGE' ? 1 : Math.max(1, Math.min(req.maxPages, 500));

  while (queue.length && pages.length < limit) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const allowed = isAllowed(robots, new URL(url));
    if (!allowed) {
      // Respect robots.txt: record the block without fetching.
      if (pages.length === 0) {
        pages.push({
          url,
          ...analyzePage({ requestedUrl: url, finalUrl: url, status: 0, headers: {}, html: '', redirects: [], elapsedMs: 0, robotsAllowed: false }),
        });
      }
      continue;
    }
    try {
      const res = await safeFetch(url, fetchOpts);
      statusByUrl.set(url, { status: res.status, redirected: res.redirects.length > 0 });
      const analysis = analyzePage({
        requestedUrl: url,
        finalUrl: res.finalUrl,
        status: res.status,
        headers: res.headers,
        html: res.body,
        redirects: res.redirects,
        elapsedMs: res.elapsedMs,
        robotsAllowed: true,
      });
      pages.push({ url, ...analysis });
      if (req.scope === 'SITE') {
        for (const link of analysis.metrics.internalLinks) {
          const n = normalize(link);
          if (!seen.has(n) && new URL(n).origin === origin && !SKIP_EXT.test(new URL(n).pathname)) queue.push(n);
        }
      }
    } catch (err) {
      const message = err instanceof SafeFetchError ? err.message : String(err);
      errors.push({ url, error: message });
      if (pages.length === 0 && err instanceof SafeFetchError && (err.code === 'BLOCKED_HOST' || err.code === 'INVALID_URL')) {
        throw err;
      }
    }
  }

  if (pages.length === 0) {
    throw new Error(errors[0]?.error ?? 'The page could not be fetched.');
  }

  // Internal link status checks (links not crawled already).
  const toCheck = new Set<string>();
  for (const page of pages) {
    for (const link of page.metrics.internalLinks) {
      const n = normalize(link);
      if (!statusByUrl.has(n) && new URL(n).origin === origin && !SKIP_EXT.test(new URL(n).pathname)) toCheck.add(n);
    }
  }
  for (const link of [...toCheck].slice(0, req.maxLinkChecks ?? 25)) {
    if (!isAllowed(robots, new URL(link))) continue;
    try {
      const res = await safeFetch(link, { ...fetchOpts, method: 'HEAD', maxBytes: 1024, timeoutMs: 8000 });
      let status = res.status;
      if (status === 405 || status === 501) status = (await safeFetch(link, { ...fetchOpts, maxBytes: 64 * 1024, timeoutMs: 8000 })).status;
      statusByUrl.set(link, { status, redirected: res.redirects.length > 0 });
    } catch {
      // network errors on secondary links are not reported as broken
    }
  }

  // Site-level findings attached to the pages they concern.
  const add = (page: CrawledPage, f: RawFinding) => page.findings.push(f);
  for (const page of pages) {
    const broken: string[] = [];
    const redirected: string[] = [];
    for (const link of page.metrics.internalLinks) {
      const s = statusByUrl.get(normalize(link));
      if (!s) continue;
      if (s.status >= 400) broken.push(link);
      else if (s.redirected) redirected.push(link);
    }
    if (broken.length) add(page, { ruleKey: 'content.broken_internal_link', details: { count: broken.length, links: broken.slice(0, 20) } });
    if (redirected.length) add(page, { ruleKey: 'content.redirected_internal_link', details: { count: redirected.length, links: redirected.slice(0, 20) } });
  }

  const ok = pages.filter((p) => p.metrics.status >= 200 && p.metrics.status < 300);
  const groupBy = (key: (p: CrawledPage) => string | null) => {
    const map = new Map<string, CrawledPage[]>();
    for (const p of ok) {
      const k = key(p);
      if (!k) continue;
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.values()].filter((g) => g.length > 1);
  };
  for (const group of groupBy((p) => p.metrics.title?.toLowerCase() ?? null)) {
    for (const p of group) add(p, { ruleKey: 'seo.title_duplicate', details: { title: p.metrics.title, pages: group.map((g) => g.url).filter((u) => u !== p.url).slice(0, 10) } });
  }
  for (const group of groupBy((p) => p.metrics.metaDescription?.toLowerCase() ?? null)) {
    for (const p of group) add(p, { ruleKey: 'seo.meta_description_duplicate', details: { pages: group.map((g) => g.url).filter((u) => u !== p.url).slice(0, 10) } });
  }
  for (const group of groupBy((p) => (p.metrics.wordCount >= 50 ? p.metrics.contentHash : null))) {
    for (const p of group) add(p, { ruleKey: 'content.duplicate', details: { pages: group.map((g) => g.url).filter((u) => u !== p.url).slice(0, 10) } });
  }

  const first = pages[0];
  if (!robotsFound) add(first, { ruleKey: 'crawl.robots_txt_missing', context: 'site' });
  if (!sitemapFound) add(first, { ruleKey: 'crawl.sitemap_missing', context: 'site' });

  return { pages, site: { robotsFound, sitemapFound, sitemaps: robots.sitemaps }, errors };
}
