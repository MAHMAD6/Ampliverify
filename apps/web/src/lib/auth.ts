import 'server-only';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { jwt } from 'better-auth/plugins/jwt';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { passkey } from '@better-auth/passkey';
import { authPool } from './auth-db';
import { sendAuthEmail } from './auth-email';
import { APIError } from 'better-auth/api';
import { canRegister, syncUserToApi } from './auth-sync';

const baseURL = (process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const socialProviders: BetterAuthOptions['socialProviders'] = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
    ? { microsoft: { clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET, tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common' } }
    : {}),
};

/** Social sign-in buttons are enabled only for providers configured here. */
export const enabledSocialProviders = Object.keys(socialProviders) as ('google' | 'microsoft')[];

/**
 * Better Auth options, shared by the running app and `scripts/auth-migrate.mts`.
 *
 * Better Auth owns credentials and sessions in its own database
 * (`AUTH_DATABASE_URL`, kept apart from the Prisma-managed API database). The
 * jwt plugin issues short-lived API bearer tokens and serves the JWKS that
 * the API verifies (`BETTER_AUTH_JWKS_URL`, issuer and audience must match the
 * API's env). Every user create/update is provisioned into the API through
 * `/internal/auth/users/sync`.
 */
export const authOptions = {
  appName: 'AmpliVerify',
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authPool,
  // Brute-force protection on every auth endpoint, stricter on credential and
  // email-sending routes. Counters live in the auth database so they hold
  // across server instances and restarts.
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
      '/reset-password': { window: 300, max: 5 },
      '/send-verification-email': { window: 300, max: 3 },
      '/two-factor/verify-totp': { window: 60, max: 5 },
      '/two-factor/verify-backup-code': { window: 60, max: 5 },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({ to: user.email, kind: 'reset-password', url });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({ to: user.email, kind: 'verify-email', url });
    },
  },
  socialProviders,
  databaseHooks: {
    user: {
      create: {
        // Super Admin → Settings can close sign-up; invited people can still join.
        before: async (user) => {
          if (!(await canRegister(user.email))) throw new APIError('FORBIDDEN', { message: 'New sign-ups are currently closed. Ask a workspace owner for an invitation.' });
        },
        after: async (user) => syncUserToApi(user),
      },
      update: { after: async (user) => syncUserToApi(user) },
    },
  },
  plugins: [
    jwt({
      jwt: {
        issuer: process.env.BETTER_AUTH_ISSUER ?? baseURL,
        audience: process.env.BETTER_AUTH_AUDIENCE ?? 'ampliverify-api',
        expirationTime: '15m',
        // The API reads `twoFactorEnabled` to enforce "Require MFA for admins".
        definePayload: ({ user }) => ({ id: user.id, email: user.email, name: user.name, twoFactorEnabled: (user as { twoFactorEnabled?: boolean }).twoFactorEnabled === true }),
      },
    }),
    // TOTP authenticator apps with backup codes (Settings → Account → Security).
    twoFactor({ issuer: 'AmpliVerify' }),
    passkey({ rpID: new URL(baseURL).hostname, rpName: 'AmpliVerify', origin: baseURL }),
    nextCookies(),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);
