export const EMPTY = '—';

export function formatDate(iso: string | null | undefined) {
  if (!iso) return EMPTY;
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** Money arrives as integer minor units serialized as a string (BigInt). */
export function formatMoney(amountMinor: string, currency: string) {
  const minor = Number(amountMinor);
  if (!Number.isFinite(minor)) return EMPTY;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}

export function initials(name: string | null | undefined, email?: string) {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase() || '?';
}

export function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function readingTime(markdown: string | null) {
  if (!markdown) return null;
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

/** Level-2 headings of a markdown body, for the "In this article" table of contents. */
export function markdownHeadings(markdown: string | null) {
  if (!markdown) return [];
  return [...markdown.matchAll(/^##\s+(.+)$/gm)].map((m) => ({ text: m[1].trim(), id: slugifyHeading(m[1]) }));
}

export function slugifyHeading(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
