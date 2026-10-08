import { NextResponse } from 'next/server';
import { apiSend } from '@/lib/api';

/**
 * Google OAuth redirect target. Exchanges the code through the API (which
 * verifies the signed state and stores the encrypted refresh token), then
 * returns to Settings → Integrations.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = new URL('/app/settings/integrations', url.origin);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error') || !code || !state) {
    back.searchParams.set('error', 'Google access was not granted.');
    return NextResponse.redirect(back);
  }
  const result = await apiSend('POST', '/user/integrations/google/callback', { code, state });
  if (result.ok) back.searchParams.set('connected', '1');
  else back.searchParams.set('error', result.message ?? 'The connection could not be completed.');
  return NextResponse.redirect(back);
}
