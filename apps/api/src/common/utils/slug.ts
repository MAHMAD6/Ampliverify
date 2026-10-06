export const SLUG_MAX_LENGTH = 120;

export function slugify(input: string, fallback: string) {
  const slug = input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** `base`, then `base-2`, `base-3`, ... kept within SLUG_MAX_LENGTH. */
export function slugCandidate(base: string, attempt: number) {
  if (attempt === 0) return base;
  const suffix = `-${attempt + 1}`;
  return `${base.slice(0, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
}
