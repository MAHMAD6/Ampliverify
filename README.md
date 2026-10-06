<p align="center">
  <img src="assets/brand/ampliverify-logo.png" alt="AmpliVerify — Audit • Optimize • Verify" width="480">
</p>

# AmpliVerify

Multi-tenant SEO and AI-search (GEO) SaaS: a public site, a user app and a Super Admin console.

This repository contains:

- **`apps/api`**: the full PostgreSQL schema plus a NestJS API for auth integration, tenancy, projects, RBAC, immutable audit logging and public content.
- **`apps/web`**: a Next.js app with the public website, the user app (`/app`) and the Super Admin console (`/admin`), built from the supplied designs. See [`docs/SCREENS.md`](docs/SCREENS.md) for which screens are live and which show empty states.

```text
apps/
  api/                     NestJS API + Prisma (schema, migrations, tests)
  web/                     Next.js: public site, user app (/app), Super Admin (/admin)
assets/brand/              Logo files
docs/
  AmpliVerify_Database_Architecture_Implementation_Guide.pdf   ← schema source of truth
  DATA_MODEL.md            Schema overview, DB-enforced rules, deviations from the guide
  API.md                   Route list and permissions
  SECURITY.md              Auth / RBAC / audit model
  INPUTS.md                Register of every supplied input file
  SCREENS.md               Screen register: design → route → data status
  design/                  Approved UI mockups (admin, public, user app)
  reference/               Original Backend Batch 1 (NestJS + TypeORM), kept for provenance
```

## Stack

Node.js ≥ 22.12 · NestJS 11 · Prisma 6 · PostgreSQL 16 · Next.js 16 / React 19 · Better Auth (JWT/JWKS) · Jest.

## Getting started

```bash
cp apps/api/.env.example apps/api/.env         # API: database, Better Auth issuer/audience/JWKS URL, AUTH_SYNC_SECRET
cp apps/web/.env.example apps/web/.env.local   # web: API_URL, Better Auth secret + database, same AUTH_SYNC_SECRET
docker compose up -d postgres                   # or any PostgreSQL 16
createdb ampliverify_auth                       # Better Auth's own database (AUTH_DATABASE_URL)
npm install
npm run db:deploy                               # API migrations (incl. RBAC/feature registries)
npm run auth:migrate --workspace apps/web       # Better Auth tables (user, session, account, verification, jwks)
npm run dev:api                                 # http://localhost:4000/api/v1
npm run dev:web                                 # http://localhost:3000 (site), /app, /admin
```

### Sign-in

Better Auth runs inside the web app at `/api/auth` (`apps/web/src/lib/auth.ts`):

- **Credentials and sessions** live in Better Auth's own database (`AUTH_DATABASE_URL`), separate from the API database. Passwords never reach the API.
- **API tokens:** the jwt plugin mints 15-minute EdDSA bearer tokens for API calls (`lib/session.ts`) and serves `/api/auth/jwks`, which the API verifies. The web `BETTER_AUTH_ISSUER`/`BETTER_AUTH_AUDIENCE` must equal the API's, and the API's `BETTER_AUTH_JWKS_URL` must point at the web origin.
- **Provisioning:** every Better Auth user create/update is synced into the API (`POST /internal/auth/users/sync`, `AUTH_SYNC_SECRET`). `/auth/continue` repeats the sync after each sign-in and, on first sign-in, creates the user's organization and default workspace.
- **Route gate:** `/app` and `/admin` redirect to `/login` without a session cookie (`src/proxy.ts`). Permissions are always enforced by the API.
- **Email:** email/password requires verification. **No email provider is wired yet** (`lib/auth-email.ts`); sending fails loudly. For local testing set `AUTH_EMAIL_LOG_LINKS=true` to print verification and reset links to the server log. This only works when `BETTER_AUTH_URL` is localhost.
- **Social:** Google and Microsoft buttons are enabled when their client id and secret are set.

First Super Admin: sign up and verify the account, then take its Better Auth user id (`select id from "user" where email = '…'` in the auth database) and run this once:

```bash
psql "$DATABASE_URL" -v auth_subject='BETTER_AUTH_USER_ID' -f apps/api/scripts/bootstrap-super-admin.sql
```

## Checks

```bash
npm run typecheck   # api + web
npm test            # unit tests
npm run test:db     # integration tests; rebuilds the database named in TEST_DATABASE_URL (must contain "test")
npm run build       # api + web
```

The integration suite covers onboarding, cross-tenant denial, RBAC anti-escalation, membership gating, append-only tables, ledger idempotency and reconciliation, and the job-application gate. It also exercises the full HTTP stack with real JWKS-signed tokens.

## Schema changes

Edit `apps/api/prisma/schema.prisma`, then run `npm run db:migrate --workspace apps/api -- --name <change>`. Review the generated SQL before committing. Rules Prisma cannot express (CHECKs, triggers, partial indexes) go in hand-written SQL inside a migration and are documented in `docs/DATA_MODEL.md`. Follow guide §20: expand → backfill → switch → contract.
