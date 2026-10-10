import 'server-only';

type AuthEmail = { to: string; kind: 'verify-email' | 'reset-password'; url: string };

const isLocalOrigin = () => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test((process.env.BETTER_AUTH_URL ?? '').replace(/\/$/, ''));

const COPY: Record<AuthEmail['kind'], { subject: string; text: (url: string) => string }> = {
  'verify-email': {
    subject: 'Verify your AmpliVerify email address',
    text: (url) => `Welcome to AmpliVerify.\n\nConfirm your email address to finish creating your account:\n${url}\n\nIf you did not sign up, you can ignore this email.`,
  },
  'reset-password': {
    subject: 'Reset your AmpliVerify password',
    text: (url) => `We received a request to reset your AmpliVerify password.\n\nChoose a new password here (the link expires soon):\n${url}\n\nIf you did not ask for this, you can ignore this email; your password stays the same.`,
  },
};

/**
 * Delivery for verification and password-reset links through Resend
 * (`RESEND_API_KEY`, `EMAIL_FROM`), the same provider the API uses.
 *
 * For local development only, `AUTH_EMAIL_LOG_LINKS=true` writes the link to
 * the server log instead; it is ignored unless BETTER_AUTH_URL is a
 * localhost origin, so links never leak into production logs. Without a
 * provider, sending fails loudly instead of pretending the email went out.
 */
export async function sendAuthEmail({ to, kind, url }: AuthEmail) {
  if (process.env.AUTH_EMAIL_LOG_LINKS === 'true' && isLocalOrigin()) {
    console.info(`[auth-email:local] ${kind} for ${to}: ${url}`);
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Email delivery is not configured (RESEND_API_KEY).');
  const copy = COPY[kind];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'AmpliVerify <no-reply@ampliverify.com>', to: [to], subject: copy.subject, text: copy.text(url) }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Email provider error ${res.status}: ${body.message ?? 'unknown'}`);
  }
}
