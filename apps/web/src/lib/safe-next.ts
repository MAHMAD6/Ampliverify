/** Accepts only same-site relative paths for post-sign-in redirects. */
export function safeNext(next: string | null | undefined, fallback = '/app/dashboard') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
