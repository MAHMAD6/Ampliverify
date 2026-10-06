import { normalizeHost } from '../../src/common/utils/domain';

describe('normalizeHost', () => {
  it.each([
    ['example.com', 'example.com'],
    ['  Example.COM  ', 'example.com'],
    ['https://www.example.com/blog?x=1#top', 'example.com'],
    ['http://user:pw@shop.example.co.uk:8080/', 'shop.example.co.uk'],
    ['example.com.', 'example.com'],
    ['www.example.org', 'example.org'],
    ['xn--bcher-kva.example', 'xn--bcher-kva.example'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });

  it.each(['', 'localhost', '127.0.0.1', 'exa mple.com', '-bad.com', 'bad-.com', 'example', 'example.c0m', 'a..b.com', `${'a'.repeat(64)}.com`])('rejects %p', (input) => {
    expect(normalizeHost(input)).toBeNull();
  });
});
