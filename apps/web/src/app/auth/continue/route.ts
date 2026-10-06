import { NextResponse, type NextRequest } from 'next/server';
import { apiGet, apiSend } from '@/lib/api';
import { syncUserToApi } from '@/lib/auth-sync';
import { normalizeHost } from '@/lib/domain';
import { safeNext } from '@/lib/safe-next';
import { getSession } from '@/lib/session';

/**
 * Post-sign-in landing for every auth flow (password, social, email link).
 *
 * 1. Re-provisions the user in the API. Idempotent; this repairs a failed
 *    sync from sign-up.
 * 2. First sign-in only: creates the user's organization and default
 *    workspace through the API's onboarding endpoint, named after the sign-up
 *    website or the user.
 * 3. Redirects to `next`, or to Add Project with the sign-up website prefilled.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url));

  try {
    await syncUserToApi(session.user);
  } catch {
    return NextResponse.redirect(new URL('/login?error=provisioning', url));
  }

  const orgs = await apiGet<{ id: string }[]>('/user/organizations', { auth: true });
  if (orgs.ok && orgs.data.length === 0) {
    const host = normalizeHost(url.searchParams.get('website') ?? '');
    const name = (host ?? `${session.user.name || session.user.email.split('@')[0]}'s Workspace`).slice(0, 160);
    const created = await apiSend('POST', '/user/organizations', { name, workspaceName: name });
    if (created.ok && host) return NextResponse.redirect(new URL(`/app/projects/new?domain=${encodeURIComponent(host)}`, url));
  }
  return NextResponse.redirect(new URL(next, url));
}
