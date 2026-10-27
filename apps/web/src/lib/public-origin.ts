/**
 * The public site origin for redirects. Behind the reverse proxy, the URL a
 * route handler sees is the internal one (e.g. http://localhost:3021), so
 * redirects are built from BETTER_AUTH_URL instead.
 */
export function publicOrigin(fallback: string | URL): string {
  const configured = process.env.BETTER_AUTH_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through to the request origin
    }
  }
  return new URL(fallback).origin;
}
