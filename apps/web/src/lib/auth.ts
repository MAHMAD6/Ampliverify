import 'server-only';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { jwt } from 'better-auth/plugins/jwt';
import { Pool } from 'pg';
import { sendAuthEmail } from './auth-email';
import { syncUserToApi } from './auth-sync';

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
  database: new Pool({ connectionString: process.env.AUTH_DATABASE_URL }),
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
      create: { after: async (user) => syncUserToApi(user) },
      update: { after: async (user) => syncUserToApi(user) },
    },
  },
  plugins: [
    jwt({
      jwt: {
        issuer: process.env.BETTER_AUTH_ISSUER ?? baseURL,
        audience: process.env.BETTER_AUTH_AUDIENCE ?? 'ampliverify-api',
        expirationTime: '15m',
      },
    }),
    nextCookies(),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);
