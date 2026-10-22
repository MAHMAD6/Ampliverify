import { NextResponse } from 'next/server';
import { apiSend } from '@/lib/api';
import { safeNext } from '@/lib/safe-next';

/**
 * Google OAuth redirect target (register this exact URL as GOOGLE_REDIRECT_URI).
 * The signed-in session forwards the code to the API, which validates the
 * single-use state, PKCE verifier and initiating user before exchanging it;
 * tokens never reach the browser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = new URL('/app/settings/integrations', url.origin);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (!state) {
    back.searchParams.set('error', 'Google connection cancelled.');
    return NextResponse.redirect(back);
  }
  if (error || !code) {
    // Close the single-use transaction and show the explicit cancel message.
    const r = await apiSend('POST', '/user/integrations/google/callback', { state, error: (error ?? 'access_denied').slice(0, 100) });
    back.searchParams.set('error', r.ok ? 'Google connection cancelled.' : (r.message ?? 'Google connection cancelled.'));
    return NextResponse.redirect(back);
  }
  const result = await apiSend<{ returnTo?: string | null }>('POST', '/user/integrations/google/callback', { code, state });
  if (result.ok && result.data.returnTo) {
    const to = new URL(safeNext(result.data.returnTo, '/app/settings/integrations'), url.origin);
    to.searchParams.set('connected', '1');
    return NextResponse.redirect(to);
  }
  if (result.ok) back.searchParams.set('connected', '1');
  else back.searchParams.set('error', result.message ?? 'The connection could not be completed.');
  return NextResponse.redirect(back);
}
