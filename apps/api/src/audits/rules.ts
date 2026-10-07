import { FindingSeverity } from '@prisma/client';

/**
 * Audit rule catalogue, derived from the AmpliVerify SEO Audit Guide
 * (docs/AmpliVerify_SEO_Audit_Guide.pdf): crawl & indexation, technical,
 * on-page, content, internal links, performance, structured data and AI
 * search (GEO). Priority follows the guide's High / Medium / Low model
 * (1 = fix first).
 */

export type AuditCategory = 'TECHNICAL' | 'SEO' | 'CONTENT' | 'GEO';

export type RuleDefinition = {
  key: string;
  category: AuditCategory;
  severity: FindingSeverity;
  priority: 1 | 2 | 3;
  title: string;
  why: string;
  guidance: string;
};

const r = (
  key: string,
  category: AuditCategory,
  severity: FindingSeverity,
  title: string,
  why: string,
  guidance: string,
): RuleDefinition => ({
  key,
  category,
  severity,
  priority: severity === 'CRITICAL' || severity === 'HIGH' ? 1 : severity === 'MEDIUM' ? 2 : 3,
  title,
  why,
  guidance,
});

export const RULES: RuleDefinition[] = [
  // Crawl & indexation
  r('crawl.robots_blocked', 'TECHNICAL', 'CRITICAL', 'Page is blocked by robots.txt',
    'Search engines cannot crawl pages disallowed in robots.txt, so they cannot rank them.',
    'Remove or narrow the Disallow rule in robots.txt that matches this URL, unless the page should stay private.'),
  r('crawl.noindex', 'TECHNICAL', 'HIGH', 'Page is set to noindex',
    'A noindex directive (meta robots or X-Robots-Tag) removes the page from search results.',
    'Remove the noindex directive if this page should appear in search.'),
  r('crawl.robots_txt_missing', 'TECHNICAL', 'LOW', 'robots.txt not found',
    'robots.txt tells crawlers what to crawl and where the sitemap is.',
    'Publish a robots.txt at the site root that references your XML sitemap.'),
  r('crawl.sitemap_missing', 'TECHNICAL', 'MEDIUM', 'XML sitemap not found',
    'A sitemap helps search engines discover important, indexable URLs.',
    'Publish an XML sitemap (for example /sitemap.xml) and reference it in robots.txt.'),
  r('crawl.canonical_missing', 'TECHNICAL', 'MEDIUM', 'Canonical tag is missing',
    'Without a canonical URL, duplicate or parameterised versions of the page can compete with each other.',
    'Add <link rel="canonical" href="…"> pointing to the preferred URL of this page.'),
  r('crawl.canonical_multiple', 'TECHNICAL', 'MEDIUM', 'Multiple canonical tags',
    'Conflicting canonical tags are ignored by search engines.',
    'Keep a single canonical tag per page.'),
  r('crawl.canonical_other', 'TECHNICAL', 'HIGH', 'Canonical points to a different URL',
    'Search engines may index the canonical target instead of this page.',
    'Confirm the canonical target is intended. If this page should rank, make the canonical self-referencing.'),

  // Technical
  r('tech.http_4xx', 'TECHNICAL', 'CRITICAL', 'Page returns a client error (4xx)',
    'Broken pages cannot be indexed and break user journeys.',
    'Restore the page, or redirect it (301) to the most relevant live page and update links to it.'),
  r('tech.http_5xx', 'TECHNICAL', 'CRITICAL', 'Page returns a server error (5xx)',
    'Server errors stop crawling and indexing and signal an unreliable site.',
    'Check server logs and fix the error; monitor uptime for this URL.'),
  r('tech.redirect_chain', 'TECHNICAL', 'MEDIUM', 'Redirect chain',
    'Each extra redirect hop slows users and wastes crawl budget.',
    'Point links and the first redirect directly at the final URL.'),
  r('tech.not_https', 'TECHNICAL', 'HIGH', 'Page is not served over HTTPS',
    'HTTPS is a ranking signal and browsers flag insecure pages.',
    'Serve the page over HTTPS and redirect HTTP to HTTPS.'),
  r('tech.mixed_content', 'TECHNICAL', 'MEDIUM', 'Insecure (HTTP) resources on an HTTPS page',
    'Browsers block or warn about mixed content.',
    'Load every script, stylesheet, image and frame over HTTPS.'),
  r('tech.slow_response', 'TECHNICAL', 'MEDIUM', 'Slow server response',
    'Slow responses hurt Largest Contentful Paint and user experience.',
    'Reduce server response time: caching, a CDN, and fewer slow backend calls.'),
  r('tech.large_html', 'TECHNICAL', 'LOW', 'Large HTML document',
    'Very large documents take longer to download and parse.',
    'Remove inline data and unused markup; paginate or lazy-load long lists.'),
  r('tech.render_blocking', 'TECHNICAL', 'LOW', 'Render-blocking scripts in <head>',
    'Synchronous scripts in the head delay rendering.',
    'Add defer or async to scripts that are not needed for first paint.'),
  r('tech.viewport_missing', 'TECHNICAL', 'HIGH', 'Mobile viewport is not set',
    'Without a viewport meta tag, pages render at desktop width on phones.',
    'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'),
  r('tech.lang_missing', 'TECHNICAL', 'LOW', 'Document language is not declared',
    'The lang attribute helps search engines and assistive technology.',
    'Add a lang attribute to the <html> element, for example lang="en".'),

  // On-page
  r('seo.title_missing', 'SEO', 'HIGH', 'Title tag is missing',
    'The title is one of the strongest on-page signals and the headline in search results.',
    'Add a unique, descriptive <title> of roughly 30–60 characters that states the page topic.'),
  r('seo.title_too_long', 'SEO', 'LOW', 'Title is too long',
    'Long titles are truncated in search results.',
    'Shorten the title to about 60 characters, keeping the main topic first.'),
  r('seo.title_too_short', 'SEO', 'LOW', 'Title is too short',
    'Very short titles miss the chance to describe the page.',
    'Expand the title to about 30–60 characters with the page’s main topic.'),
  r('seo.title_duplicate', 'SEO', 'MEDIUM', 'Duplicate title',
    'Pages sharing a title compete with each other and confuse searchers.',
    'Give each page a unique title that reflects its specific content.'),
  r('seo.meta_description_missing', 'SEO', 'MEDIUM', 'Meta description is missing',
    'Search engines may generate a less relevant snippet.',
    'Write a unique meta description of roughly 70–160 characters that summarises the page.'),
  r('seo.meta_description_too_long', 'SEO', 'LOW', 'Meta description is too long',
    'Long descriptions are truncated in search results.',
    'Keep the meta description under about 160 characters.'),
  r('seo.meta_description_too_short', 'SEO', 'LOW', 'Meta description is too short',
    'Short descriptions under-sell the page in results.',
    'Expand the description to about 70–160 characters.'),
  r('seo.meta_description_duplicate', 'SEO', 'MEDIUM', 'Duplicate meta description',
    'Identical snippets make pages hard to tell apart in results.',
    'Write a unique description for each page.'),
  r('seo.h1_missing', 'SEO', 'HIGH', 'H1 heading is missing',
    'The H1 tells users and search engines what the page is about.',
    'Add a single H1 that states the main topic of the page.'),
  r('seo.h1_multiple', 'SEO', 'LOW', 'Multiple H1 headings',
    'Several H1s dilute the page’s main topic.',
    'Keep one H1 and turn the others into H2/H3 section headings.'),
  r('seo.heading_skip', 'SEO', 'LOW', 'Heading levels are skipped',
    'Skipped levels (for example H2 → H4) make the outline harder to follow.',
    'Use headings in order so each section nests logically.'),
  r('seo.og_missing', 'SEO', 'LOW', 'Open Graph tags are missing',
    'Shared links show a poor preview without og:title, og:description and og:image.',
    'Add Open Graph title, description and image tags.'),

  // Content & links
  r('content.thin', 'CONTENT', 'MEDIUM', 'Thin content',
    'Pages with little useful text rarely satisfy search intent.',
    'Expand the page so it fully answers the visitor’s question, or consolidate it with a related page.'),
  r('content.duplicate', 'CONTENT', 'MEDIUM', 'Duplicate content',
    'Near-identical pages compete for the same queries.',
    'Consolidate duplicates into one page, or canonicalise them to the preferred version.'),
  r('content.images_missing_alt', 'CONTENT', 'MEDIUM', 'Images without alt text',
    'Alt text describes images to search engines and screen readers.',
    'Add concise, descriptive alt text to meaningful images (decorative images can use alt="").'),
  r('content.no_internal_links', 'CONTENT', 'LOW', 'No internal links',
    'Internal links help users and crawlers discover related pages.',
    'Link to related pages on your site with descriptive anchor text.'),
  r('content.generic_anchor', 'CONTENT', 'LOW', 'Generic link anchor text',
    'Anchors like “click here” say nothing about the destination.',
    'Use anchor text that describes the linked page.'),
  r('content.broken_internal_link', 'CONTENT', 'HIGH', 'Broken internal links',
    'Links to missing pages waste crawl budget and frustrate users.',
    'Update or remove links that return 4xx/5xx responses.'),
  r('content.redirected_internal_link', 'CONTENT', 'LOW', 'Internal links to redirects',
    'Linking through redirects slows users and crawlers.',
    'Update internal links to point at the final URL.'),

  // Structured data
  r('schema.missing', 'SEO', 'MEDIUM', 'No structured data',
    'Structured data helps search engines understand the page and enables rich results.',
    'Add JSON-LD schema that matches the page (Organization, Article, Product, Breadcrumb…).'),
  r('schema.invalid', 'SEO', 'HIGH', 'Invalid structured data',
    'Search engines ignore JSON-LD that does not parse.',
    'Fix the JSON syntax in the JSON-LD block and validate it.'),

  // AI search (GEO)
  r('geo.no_entity_schema', 'GEO', 'MEDIUM', 'Brand entity is not described',
    'AI systems rely on clear entity information (Organization/Person schema, consistent naming) to attribute answers.',
    'Add Organization (or Person) JSON-LD with name, logo, url and sameAs profiles.'),
  r('geo.no_question_headings', 'GEO', 'LOW', 'No question-style headings',
    'AI answers often quote sections that directly address a question.',
    'Add headings phrased as the questions your audience asks, each followed by a concise answer.'),
  r('geo.no_faq', 'GEO', 'LOW', 'No FAQ content or schema',
    'FAQs give AI search concise, citable answers.',
    'Add an FAQ section for common questions and mark it up with FAQPage schema where appropriate.'),
  r('geo.no_author', 'GEO', 'LOW', 'No author attribution',
    'Clear authorship supports trust and source attribution.',
    'Show the author (with a short bio) and add author to Article schema.'),
  r('geo.no_date', 'GEO', 'LOW', 'No published or updated date',
    'AI systems prefer current, dated sources.',
    'Show the published/updated date and include datePublished/dateModified in schema.'),
  r('geo.no_citations', 'GEO', 'LOW', 'No supporting sources',
    'Linking to evidence makes content more citable.',
    'Support factual claims with links to authoritative sources.'),
  r('geo.long_paragraphs', 'GEO', 'LOW', 'Long, dense paragraphs',
    'Concise answers are easier for AI systems to extract and quote.',
    'Break long paragraphs up and lead each section with a short, direct answer.'),
  r('geo.no_structure', 'GEO', 'INFO', 'No lists or tables',
    'Lists and tables are easy for AI answers to summarise.',
    'Use lists or tables for steps, comparisons and key facts.'),
];

export const RULES_BY_KEY = new Map(RULES.map((rule) => [rule.key, rule]));

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  TECHNICAL: 'Technical',
  SEO: 'SEO',
  CONTENT: 'Content',
  GEO: 'AI Search (GEO)',
};

export const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  CRITICAL: 40,
  HIGH: 20,
  MEDIUM: 10,
  LOW: 4,
  INFO: 0,
};
