/**
 * Normalizes user input such as "https://www.Example.com/path" to a bare host
 * ("example.com"): no scheme, credentials, port, path, query, trailing dot or
 * leading "www.". Returns null when the result is not a valid public hostname
 * (letters, digits and hyphens in dot-separated labels, at least one dot, an
 * alphabetic TLD; IP addresses and "localhost" are rejected).
 */
export function normalizeHost(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.replace(/^[^@/]*@/, '');
  value = value.split(/[/?#]/, 1)[0];
  value = value.replace(/:\d*$/, '').replace(/\.$/, '');
  if (value.startsWith('www.')) value = value.slice(4);

  if (value.length > 253) return null;
  const labels = value.split('.');
  if (labels.length < 2) return null;
  const label = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
  if (!labels.every((l) => label.test(l))) return null;
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1]) && !/^xn--[a-z0-9-]+$/.test(labels[labels.length - 1])) return null;
  return value;
}
