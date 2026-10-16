import 'server-only';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

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

let client: SESv2Client | null = null;

/**
 * Delivery for verification and password-reset links through Amazon SES v2
 * (`SES_REGION`, `EMAIL_FROM`, optional `SES_ACCESS_KEY_ID` /
 * `SES_SECRET_ACCESS_KEY`), the same provider the API uses.
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
  const region = process.env.SES_REGION;
  if (!region) throw new Error('Email delivery is not configured (SES_REGION).');
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  client ??= new SESv2Client({ region, ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) });
  const copy = COPY[kind];
  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.EMAIL_FROM ?? 'AmpliVerify <no-reply@ampliverify.com>',
        Destination: { ToAddresses: [to] },
        ...(process.env.SES_CONFIGURATION_SET ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET } : {}),
        Content: { Simple: { Subject: { Data: copy.subject, Charset: 'UTF-8' }, Body: { Text: { Data: copy.text(url), Charset: 'UTF-8' } } } },
      }),
    );
  } catch (err) {
    throw new Error(`Email provider error (${(err as { name?: string }).name ?? 'Error'}): ${err instanceof Error ? err.message : 'unknown'}`);
  }
}
