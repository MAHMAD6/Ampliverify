import { redactPii } from '../../src/ai/openai.service';
import { analyzeAnswer, normalizeSerp } from '../../src/geo/geo-providers';

describe('DataForSEO SERP normalization (GEO evidence)', () => {
  it('extracts the AI Mode answer and its references', () => {
    const result = {
      items: [
        {
          type: 'ai_overview',
          markdown: 'Acme is a leading widget maker.',
          references: [
            { type: 'ai_overview_reference', url: 'https://www.acme.test/about', title: 'About Acme', domain: 'www.acme.test' },
            { type: 'ai_overview_reference', url: 'https://reviews.test/widgets', title: 'Reviews', domain: 'reviews.test' },
          ],
        },
      ],
    };
    const n = normalizeSerp('google_ai_mode', result);
    expect(n.aiPresent).toBe(true);
    expect(n.text).toBe('Acme is a leading widget maker.');
    expect(n.citations.map((c) => c.domain)).toEqual(['acme.test', 'reviews.test']);
    expect(n.organic).toEqual([]);
    const a = analyzeAnswer(n, { names: ['Acme'], domains: ['acme.test'] }, []);
    expect(a).toMatchObject({ mentioned: true, cited: true, citationRank: 1 });
  });

  it('reads AI Overview element references and organic results; no AI block means not observed', () => {
    const withOverview = normalizeSerp('google_organic', {
      items: [
        { type: 'ai_overview', items: [{ type: 'ai_overview_element', text: 'Widgets explained.', references: [{ url: 'https://wiki.test/w', domain: 'wiki.test' }] }] },
        { type: 'organic', rank_group: 1, url: 'https://acme.test/', domain: 'acme.test', title: 'Acme' },
      ],
    });
    expect(withOverview).toMatchObject({ aiPresent: true, text: 'Widgets explained.', organic: [{ rank: 1, domain: 'acme.test' }] });
    expect(withOverview.linkedDomains.sort()).toEqual(['acme.test', 'wiki.test']);

    const none = normalizeSerp('google_organic', { items: [{ type: 'organic', rank_group: 1, url: 'https://acme.test/', domain: 'acme.test' }] });
    expect(none.aiPresent).toBe(false);
    expect(none.citations).toEqual([]);
    expect(normalizeSerp('google_ai_mode', null)).toMatchObject({ aiPresent: false, text: '' });
  });
});

describe('OpenAI prompt PII minimization', () => {
  it('redacts emails and phone numbers', () => {
    expect(redactPii('Contact jane.doe@example.com or +1 (555) 123-4567 today.')).toBe('Contact [email] or [phone] today.');
    expect(redactPii('Version 2.0 released in 2026')).toBe('Version 2.0 released in 2026');
  });
});
