import { SLUG_MAX_LENGTH, slugCandidate, slugify } from '../../src/common/utils/slug';

describe('slugify', () => {
  it('normalizes to lower-case dash separated ascii', () => {
    expect(slugify('  Acme SEO — Team #1 ', 'x')).toBe('acme-seo-team-1');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Crème', 'x')).toBe('cafe-creme');
  });

  it('falls back when nothing usable remains', () => {
    expect(slugify('!!!', 'workspace')).toBe('workspace');
  });

  it('caps length without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(SLUG_MAX_LENGTH - 1)} b`, 'x');
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('slugCandidate', () => {
  it('returns the base first, then numbered variants within the limit', () => {
    const base = 'b'.repeat(SLUG_MAX_LENGTH);
    expect(slugCandidate('acme', 0)).toBe('acme');
    expect(slugCandidate('acme', 1)).toBe('acme-2');
    expect(slugCandidate(base, 9)).toHaveLength(SLUG_MAX_LENGTH);
    expect(slugCandidate(base, 9).endsWith('-10')).toBe(true);
  });
});
