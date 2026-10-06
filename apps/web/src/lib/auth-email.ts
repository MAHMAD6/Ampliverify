import 'server-only';

type AuthEmail = { to: string; kind: 'verify-email' | 'reset-password'; url: string };

const isLocalOrigin = () => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test((process.env.BETTER_AUTH_URL ?? '').replace(/\/$/, ''));

/**
 * Delivery for verification and password-reset links.
 *
 * No email provider has been chosen yet. For local development only,
 * `AUTH_EMAIL_LOG_LINKS=true` writes the link to the server log; it is
 * ignored unless BETTER_AUTH_URL is a localhost origin, so links never leak
 * into production logs. Otherwise sending fails loudly instead of pretending
 * the email went out. Plug the provider in here once one is selected.
 */
export async function sendAuthEmail({ to, kind, url }: AuthEmail) {
  if (process.env.AUTH_EMAIL_LOG_LINKS === 'true' && isLocalOrigin()) {
    console.info(`[auth-email:local] ${kind} for ${to}: ${url}`);
    return;
  }
  throw new Error('Email delivery is not configured (lib/auth-email.ts).');
}
