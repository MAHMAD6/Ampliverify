import { analyzePage, fingerprint, scoreFindings } from '../../src/audits/analyzer';
import { isAllowed, parseRobots } from '../../src/audits/robots';
import { RULES } from '../../src/audits/rules';
import { isBlockedAddress, parsePublicUrl } from '../../src/common/utils/safe-fetch';

const page = (html: string, extra: Partial<Parameters<typeof analyzePage>[0]> = {}) =>
  analyzePage({
    requestedUrl: 'https://example.com/guide',
    finalUrl: 'https://example.com/guide',
    status: 200,
    headers: { 'content-type': 'text/html' },
    html,
    redirects: [],
    elapsedMs: 120,
    robotsAllowed: true,
    ...extra,
  });

const keys = (html: string, extra?: Partial<Parameters<typeof analyzePage>[0]>) => page(html, extra).findings.map((f) => f.ruleKey);

const GOOD = `<!doctype html><html lang="en"><head>
<title>How to run an SEO audit: a practical guide</title>
<meta name="description" content="A practical guide to auditing crawlability, metadata, content quality, structured data and AI search visibility.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://example.com/guide">
<meta property="og:title" content="SEO audit guide"><meta property="og:image" content="https://example.com/og.png">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Example"},{"@type":"Article","author":{"@type":"Person","name":"Ana"},"datePublished":"2026-01-01"},{"@type":"FAQPage"}]}</script>
</head><body><h1>SEO audit guide</h1>
<h2>What is an SEO audit?</h2><p>${'word '.repeat(110)}</p><p>${'word '.repeat(110)}</p><p>${'word '.repeat(110)}</p>
<ul><li>One</li></ul><a href="/pricing">Pricing plans</a> <a href="https://developers.google.com/search">Google Search docs</a>
<img src="/a.png" alt="Chart">
</body></html>`;

describe('audit analyzer', () => {
  it('reports no issues for a well-optimised page', () => {
    expect(keys(GOOD)).toEqual([]);
    const { metrics } = page(GOOD);
    expect(metrics.title).toBe('How to run an SEO audit: a practical guide');
    expect(metrics.wordCount).toBeGreaterThan(300);
    expect(metrics.schemaTypes).toEqual(expect.arrayContaining(['Organization', 'Article', 'FAQPage', 'Person']));
    expect(metrics.indexable).toBe(true);
  });

  it('detects missing on-page basics', () => {
    const k = keys('<html><head></head><body><p>Hi</p><img src="x.png"></body></html>');
    expect(k).toEqual(
      expect.arrayContaining([
        'seo.title_missing',
        'seo.meta_description_missing',
        'seo.h1_missing',
        'crawl.canonical_missing',
        'tech.viewport_missing',
        'tech.lang_missing',
        'content.thin',
        'content.images_missing_alt',
        'schema.missing',
        'geo.no_entity_schema',
      ]),
    );
  });

  it('detects indexation and technical problems', () => {
    expect(keys(GOOD.replace('<head>', '<head><meta name="robots" content="noindex">'))).toContain('crawl.noindex');
    expect(keys(GOOD, { headers: { 'content-type': 'text/html', 'x-robots-tag': 'noindex' } })).toContain('crawl.noindex');
    expect(keys(GOOD.replace('href="https://example.com/guide"', 'href="https://example.com/other"'))).toContain('crawl.canonical_other');
    expect(keys('', { status: 404 })).toEqual(['tech.http_4xx']);
    expect(keys('', { status: 503 })).toEqual(['tech.http_5xx']);
    expect(keys(GOOD, { redirects: [{ url: 'http://a', status: 301 }, { url: 'http://b', status: 301 }] })).toContain('tech.redirect_chain');
    expect(keys(GOOD, { finalUrl: 'http://example.com/guide' })).toContain('tech.not_https');
    expect(keys(GOOD.replace('<h1>SEO audit guide</h1>', '<h1>A</h1><h1>B</h1>'))).toContain('seo.h1_multiple');
    expect(keys(GOOD.replace('"@context"', '"@context" x'))).toContain('schema.invalid');
    expect(keys(GOOD.replace('<a href="/pricing">Pricing plans</a>', '<a href="/pricing">click here</a>'))).toContain('content.generic_anchor');
  });

  it('only reports rules from the catalogue', () => {
    const known = new Set(RULES.map((r) => r.key));
    for (const f of page('<html><body></body></html>').findings) expect(known.has(f.ruleKey)).toBe(true);
  });

  it('scores by severity per category', () => {
    expect(scoreFindings([]).overall).toBe(100);
    const s = scoreFindings([{ ruleKey: 'tech.http_5xx' }, { ruleKey: 'seo.title_missing' }]);
    expect(s.TECHNICAL).toBe(60);
    expect(s.SEO).toBe(80);
    expect(s.overall).toBe(Math.round((60 + 80 + 100 + 100) / 4));
  });

  it('fingerprints are stable per page, rule and context', () => {
    expect(fingerprint('https://a/x', 'seo.title_missing')).toBe(fingerprint('https://a/x', 'seo.title_missing'));
    expect(fingerprint('https://a/x', 'seo.title_missing')).not.toBe(fingerprint('https://a/y', 'seo.title_missing'));
  });
});

describe('robots.txt', () => {
  const rules = parseRobots(`
User-agent: *
Disallow: /private
Allow: /private/public
Disallow: /*.pdf$

User-agent: AmpliVerifyBot
Disallow: /no-bot

Sitemap: https://example.com/sitemap.xml`);

  it('uses the most specific group and longest match', () => {
    expect(isAllowed(rules, new URL('https://example.com/no-bot'))).toBe(false);
    expect(isAllowed(rules, new URL('https://example.com/private'))).toBe(true);
    expect(isAllowed(rules, new URL('https://example.com/private'), 'OtherBot')).toBe(false);
    expect(isAllowed(rules, new URL('https://example.com/private/public/x'), 'OtherBot')).toBe(true);
    expect(isAllowed(rules, new URL('https://example.com/file.pdf'), 'OtherBot')).toBe(false);
    expect(rules.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });
});

describe('safe fetch URL guard', () => {
  it('blocks private and special addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) expect(isBlockedAddress(ip)).toBe(false);
  });

  it('accepts only public http(s) URLs on standard ports', () => {
    expect(parsePublicUrl('https://example.com/a#x').toString()).toBe('https://example.com/a');
    for (const bad of ['ftp://example.com', 'file:///etc/passwd', 'https://user:pw@example.com', 'http://example.com:8080', 'not a url']) {
      expect(() => parsePublicUrl(bad)).toThrow();
    }
  });
});
