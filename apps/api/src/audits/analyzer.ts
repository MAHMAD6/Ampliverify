import { load } from 'cheerio';
import { createHash } from 'crypto';
import { FindingSeverity } from '@prisma/client';
import { AuditCategory, RULES, RULES_BY_KEY, SEVERITY_WEIGHT } from './rules';

export type PageInput = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  redirects: { url: string; status: number }[];
  elapsedMs: number;
  robotsAllowed: boolean;
};

export type RawFinding = {
  ruleKey: string;
  /** Distinguishes multiple findings of one rule on one page (fingerprint input). */
  context?: string;
  details?: Record<string, unknown>;
};

export type PageMetrics = {
  url: string;
  finalUrl: string;
  status: number;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  headings: { level: number; text: string }[];
  wordCount: number;
  canonical: string | null;
  lang: string | null;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinks: string[];
  externalLinks: string[];
  schemaTypes: string[];
  responseTimeMs: number;
  htmlBytes: number;
  contentHash: string;
  indexable: boolean;
};

export type PageAnalysis = { metrics: PageMetrics; findings: RawFinding[] };

const GENERIC_ANCHORS = new Set(['click here', 'here', 'read more', 'more', 'learn more', 'this', 'link', 'this link']);
const QUESTION_RE = /^(how|what|why|when|where|who|which|can|does|do|is|are|should|will)\b|\?$/i;

function normalizeLink(href: string, base: URL): URL | null {
  try {
    const url = new URL(href, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function sameSite(a: URL, b: URL) {
  return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '');
}

function collectSchemaTypes(node: unknown, out: Set<string>) {
  if (Array.isArray(node)) return node.forEach((n) => collectSchemaTypes(n, out));
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const type = obj['@type'];
    if (typeof type === 'string') out.add(type);
    if (Array.isArray(type)) type.forEach((t) => typeof t === 'string' && out.add(t));
    if (obj['@graph']) collectSchemaTypes(obj['@graph'], out);
    for (const key of ['mainEntity', 'author', 'publisher', 'itemListElement']) {
      if (obj[key]) collectSchemaTypes(obj[key], out);
    }
  }
}

/** Single-page checks. Site-level checks (duplicates, sitemap, link status) run in the crawler. */
export function analyzePage(input: PageInput): PageAnalysis {
  const findings: RawFinding[] = [];
  const add = (ruleKey: string, details?: Record<string, unknown>, context?: string) => {
    if (!RULES_BY_KEY.has(ruleKey)) throw new Error(`Unknown audit rule ${ruleKey}`);
    findings.push({ ruleKey, details, context });
  };

  const base = new URL(input.finalUrl);
  const html = input.html ?? '';
  const isHtml = /html/i.test(input.headers['content-type'] ?? 'text/html');
  const $ = load(isHtml ? html : '');

  const title = $('head > title').first().text().trim() || $('title').first().text().trim() || null;
  const metaDescription = $('meta[name="description" i]').attr('content')?.trim() || null;
  const h1 = $('h1').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
  const headings = $('h1,h2,h3,h4,h5,h6')
    .map((_, el) => ({ level: Number(el.tagName.slice(1)), text: $(el).text().replace(/\s+/g, ' ').trim() }))
    .get();
  const canonicals = $('link[rel="canonical" i]').map((_, el) => $(el).attr('href') ?? '').get().filter(Boolean);
  const canonical = canonicals[0] ? normalizeLink(canonicals[0], base)?.toString() ?? null : null;
  const lang = $('html').attr('lang')?.trim() || null;
  const robotsMeta = ($('meta[name="robots" i]').attr('content') ?? '').toLowerCase();
  const xRobots = (input.headers['x-robots-tag'] ?? '').toLowerCase();
  const noindex = robotsMeta.includes('noindex') || xRobots.includes('noindex');

  // Visible text
  const body = $('body').clone();
  body.find('script,style,noscript,template,svg,nav,footer').remove();
  const text = body.text().replace(/\s+/g, ' ').trim();
  const wordCount = text ? text.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
  const contentHash = createHash('sha256').update(text.toLowerCase()).digest('hex');

  // Images
  const images = $('img');
  const imagesMissingAlt = images.filter((_, el) => $(el).attr('alt') === undefined).length;

  // Links
  const internal = new Set<string>();
  const external = new Set<string>();
  const genericAnchors: string[] = [];
  $('a[href]').each((_, el) => {
    const link = normalizeLink($(el).attr('href') ?? '', base);
    if (!link) return;
    const anchor = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase();
    if (GENERIC_ANCHORS.has(anchor)) genericAnchors.push(anchor);
    if (sameSite(link, base)) {
      if (link.toString() !== base.toString()) internal.add(link.toString());
    } else {
      external.add(link.toString());
    }
  });

  // Structured data
  const schemaTypes = new Set<string>();
  let invalidSchema = 0;
  $('script[type="application/ld+json" i]').each((_, el) => {
    try {
      collectSchemaTypes(JSON.parse($(el).text()), schemaTypes);
    } catch {
      invalidSchema++;
    }
  });

  const metrics: PageMetrics = {
    url: input.requestedUrl,
    finalUrl: input.finalUrl,
    status: input.status,
    title,
    metaDescription,
    h1,
    headings: headings.slice(0, 200),
    wordCount,
    canonical,
    lang,
    imageCount: images.length,
    imagesMissingAlt,
    internalLinks: [...internal].slice(0, 500),
    externalLinks: [...external].slice(0, 500),
    schemaTypes: [...schemaTypes],
    responseTimeMs: input.elapsedMs,
    htmlBytes: Buffer.byteLength(html),
    contentHash,
    indexable: input.status >= 200 && input.status < 300 && !noindex && input.robotsAllowed,
  };

  // ── Crawl & technical ────────────────────────────────────────────────
  if (!input.robotsAllowed) add('crawl.robots_blocked');
  if (input.status >= 500) add('tech.http_5xx', { status: input.status });
  else if (input.status >= 400) add('tech.http_4xx', { status: input.status });
  if (input.redirects.length > 1) add('tech.redirect_chain', { hops: input.redirects.map((h) => `${h.status} ${h.url}`) });
  if (base.protocol !== 'https:') add('tech.not_https');

  // Content checks only make sense for a successful HTML response.
  if (input.status < 200 || input.status >= 300 || !isHtml) {
    return { metrics, findings };
  }

  if (noindex) add('crawl.noindex', { source: robotsMeta.includes('noindex') ? 'meta robots' : 'X-Robots-Tag' });
  if (canonicals.length === 0) add('crawl.canonical_missing');
  else if (canonicals.length > 1) add('crawl.canonical_multiple', { canonicals });
  else if (canonical && canonical.replace(/\/$/, '') !== input.finalUrl.replace(/\/$/, '')) {
    add('crawl.canonical_other', { canonical });
  }
  if (base.protocol === 'https:') {
    const insecure = $('script[src^="http:"],link[rel="stylesheet"][href^="http:"],img[src^="http:"],iframe[src^="http:"]')
      .map((_, el) => $(el).attr('src') ?? $(el).attr('href'))
      .get();
    if (insecure.length) add('tech.mixed_content', { count: insecure.length, examples: insecure.slice(0, 5) });
  }
  if (input.elapsedMs > 1500) add('tech.slow_response', { ms: input.elapsedMs });
  if (metrics.htmlBytes > 1_500_000) add('tech.large_html', { bytes: metrics.htmlBytes });
  const blockingScripts = $('head script[src]').filter((_, el) => {
    const a = $(el).attr();
    return !('async' in (a ?? {})) && !('defer' in (a ?? {})) && ($(el).attr('type') ?? 'text/javascript') !== 'module';
  }).length;
  if (blockingScripts >= 3) add('tech.render_blocking', { count: blockingScripts });
  if ($('meta[name="viewport" i]').length === 0) add('tech.viewport_missing');
  if (!lang) add('tech.lang_missing');

  // ── On-page ──────────────────────────────────────────────────────────
  if (!title) add('seo.title_missing');
  else if (title.length > 60) add('seo.title_too_long', { length: title.length, title });
  else if (title.length < 30) add('seo.title_too_short', { length: title.length, title });
  if (!metaDescription) add('seo.meta_description_missing');
  else if (metaDescription.length > 160) add('seo.meta_description_too_long', { length: metaDescription.length });
  else if (metaDescription.length < 70) add('seo.meta_description_too_short', { length: metaDescription.length });
  if (h1.length === 0) add('seo.h1_missing');
  else if (h1.length > 1) add('seo.h1_multiple', { count: h1.length, headings: h1.slice(0, 5) });
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      add('seo.heading_skip', { from: `H${headings[i - 1].level}`, to: `H${headings[i].level}`, heading: headings[i].text });
      break;
    }
  }
  if (!$('meta[property="og:title"]').length || !$('meta[property="og:image"]').length) add('seo.og_missing');
  if (invalidSchema) add('schema.invalid', { blocks: invalidSchema });
  else if (schemaTypes.size === 0) add('schema.missing');

  // ── Content ──────────────────────────────────────────────────────────
  if (wordCount < 300) add('content.thin', { wordCount });
  if (imagesMissingAlt > 0) add('content.images_missing_alt', { count: imagesMissingAlt, total: images.length });
  if (internal.size === 0) add('content.no_internal_links');
  if (genericAnchors.length) add('content.generic_anchor', { count: genericAnchors.length, anchors: [...new Set(genericAnchors)] });

  // ── AI search (GEO) ──────────────────────────────────────────────────
  const types = [...schemaTypes].map((t) => t.toLowerCase());
  if (!types.some((t) => ['organization', 'corporation', 'localbusiness', 'person'].includes(t))) add('geo.no_entity_schema');
  const questionHeadings = headings.filter((h) => h.level >= 2 && QUESTION_RE.test(h.text));
  if (questionHeadings.length === 0) add('geo.no_question_headings');
  if (!types.includes('faqpage') && !/\bfaq|frequently asked/i.test(headings.map((h) => h.text).join(' '))) add('geo.no_faq');
  const hasAuthor =
    $('[rel="author"], meta[name="author" i], [itemprop="author"], .author, .byline').length > 0 || /"author"\s*:/.test(html);
  if (!hasAuthor) add('geo.no_author');
  const hasDate =
    $('time[datetime], meta[property="article:published_time"], meta[property="article:modified_time"], [itemprop="datePublished"], [itemprop="dateModified"]').length > 0 ||
    /"date(Published|Modified)"\s*:/.test(html);
  if (!hasDate) add('geo.no_date');
  if (external.size === 0 && wordCount >= 300) add('geo.no_citations');
  const longParagraphs = $('p').filter((_, el) => $(el).text().trim().split(/\s+/).length > 150).length;
  if (longParagraphs > 0) add('geo.long_paragraphs', { count: longParagraphs });
  if ($('ul,ol,table').length === 0) add('geo.no_structure');

  return { metrics, findings };
}

export function fingerprint(pageUrl: string, ruleKey: string, context = '') {
  return createHash('sha256').update(`${pageUrl}\n${ruleKey}\n${context}`).digest('hex');
}

export type CategoryScores = Record<AuditCategory, number> & { overall: number };

/** 100 minus severity weights per category, floored at 0; overall is the mean of the four. */
export function scoreFindings(findings: { ruleKey: string; severity?: FindingSeverity }[]): CategoryScores {
  const penalty: Record<AuditCategory, number> = { TECHNICAL: 0, SEO: 0, CONTENT: 0, GEO: 0 };
  for (const f of findings) {
    const rule = RULES_BY_KEY.get(f.ruleKey);
    if (!rule) continue;
    penalty[rule.category] += SEVERITY_WEIGHT[f.severity ?? rule.severity];
  }
  const score = (c: AuditCategory) => Math.max(0, 100 - penalty[c]);
  const result = { TECHNICAL: score('TECHNICAL'), SEO: score('SEO'), CONTENT: score('CONTENT'), GEO: score('GEO') };
  return { ...result, overall: Math.round((result.TECHNICAL + result.SEO + result.CONTENT + result.GEO) / 4) };
}

export { RULES };
