import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Optimistic gate for the signed-in areas: no session cookie → /login. This
 * only checks the cookie's presence; the session itself is validated on the
 * server and every permission is enforced by the API.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = { matcher: ['/app/:path*', '/admin/:path*'] };
