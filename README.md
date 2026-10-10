<p align="center">
  <img src="assets/brand/ampliverify-logo.png" alt="AmpliVerify — Audit • Optimize • Verify" width="480">
</p>

# AmpliVerify

Multi-tenant SEO and AI-search (GEO) SaaS: a public site, a user app and a Super Admin console.

This repository contains:

- **`apps/api`**: the PostgreSQL schema and a NestJS API: tenancy, RBAC and audit log; SEO/GEO audits, optimization and verification; On-Page SEO Editor; content strategy; keyword research (DataForSEO); AI Search (GEO) tracking across ChatGPT, Claude, Gemini and Perplexity; reports; credits, entitlements and Stripe billing; integrations (WordPress, Google Search Console/GA4); CMS, careers, support; platform operations. A Postgres-backed job queue runs inside the API process.
- **`apps/web`**: a Next.js app with the public website, the user app (`/app`) and the Super Admin console (`/admin`), built from the supplied designs and wired to the API. See [`docs/SCREENS.md`](docs/SCREENS.md) and [`docs/API.md`](docs/API.md).

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
  ROADMAP.md               Build status and remaining launch work
  design/                  Approved UI mockups (admin, public, user app)
  reference/               Original Backend Batch 1 (NestJS + TypeORM), kept for provenance
```

## Stack

Node.js ≥ 22.12 · NestJS 11 · Prisma 6 · PostgreSQL 16 · Next.js 16 / React 19 · Better Auth (JWT/JWKS) · Jest.

## Getting started

```bash
cp apps/api/.env.example apps/api/.env         # API: database, Better Auth issuer/audience/JWKS URL, AUTH_SYNC_SECRET, provider keys (all optional)
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
- **Email:** email/password requires verification. Emails go through Resend (`RESEND_API_KEY`, `EMAIL_FROM` in both apps). For local testing set `AUTH_EMAIL_LOG_LINKS=true` (web) and `EMAIL_LOG_ONLY=true` (API) to print messages to the server log instead; the web flag only works when `BETTER_AUTH_URL` is localhost.
- **Social:** Google and Microsoft buttons are enabled when their client id and secret are set.

First Super Admin: sign up and verify the account, then take its Better Auth user id (`select id from "user" where email = '…'` in the auth database) and run this once:

```bash
psql "$DATABASE_URL" -v auth_subject='BETTER_AUTH_USER_ID' -f apps/api/scripts/bootstrap-super-admin.sql
```

### Providers

Every external provider is optional; the dependent feature is disabled with an explanation until its keys are set (see `apps/api/.env.example`):

| Feature | Variables |
|---|---|
| Payments, credit packs | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (webhook: `POST /api/v1/webhooks/stripe`) |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` |
| AI ideas, briefs, editor suggestions, Claude GEO checks | `ANTHROPIC_API_KEY` |
| GEO checks on ChatGPT / Gemini / Perplexity | `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY` |
| Keyword research | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` |
| CMS (WordPress, Webflow, Shopify, custom webhook) and Google credentials encryption | `INTEGRATION_ENCRYPTION_KEY` (32+ characters) |
| Google Search Console / GA4 | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` |
| File storage | `STORAGE_DRIVER=s3` + `S3_*` (default: local `STORAGE_DIR`) |
| Applicant file malware scanning | `CLAMAV_HOST`, `CLAMAV_PORT` (files stay undownloadable until scanned clean) |

Credit costs, credit packs, the default plan, sign-up credits, maintenance mode, the sign-up gate, admin MFA and staff alert recipients are set in **Super Admin → Settings**.

## Security and retention

- Web: Content-Security-Policy, HSTS, `X-Frame-Options: DENY` and related headers (`apps/web/next.config.ts`); editor HTML is sanitized with DOMPurify.
- Auth: Better Auth rate limits stored in the auth database (sign-in, sign-up, password reset, verification email and MFA verification have tighter per-route limits).
- API: per-user/per-IP rate limit (`RATE_LIMIT_PER_MINUTE`, default 600); public contact and job-application forms are limited to 10 per minute. `TRUST_PROXY` controls which proxies' `X-Forwarded-For` is trusted.
- Outbound requests (audits, CMS, webhooks) go through the SSRF-safe fetcher; CMS and Google credentials are encrypted at rest. Custom-website webhooks are signed: `X-AmpliVerify-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">` with the `whsec_` secret shown once at connection time.
- CSV exports neutralize spreadsheet formulas.
- Production start-up refuses `AUDIT_ALLOW_PRIVATE_HOSTS=true`, `EMAIL_LOG_ONLY=true` and short encryption keys.
- Retention (daily job): deleted projects are purged after `PROJECT_PURGE_GRACE_DAYS` (default 30); audits, GEO checks, keyword research and reports older than the workspace retention setting are removed (the latest completed audit per project is kept); expired export files are deleted.

## Checks

```bash
npm run typecheck   # api + web
npm test            # unit tests
npm run test:db     # integration tests; rebuilds the database named in TEST_DATABASE_URL (must contain "test")
npm run build       # api + web
```

The integration suite covers onboarding, cross-tenant denial, RBAC anti-escalation, membership gating, append-only tables, ledger idempotency and reconciliation, audits against a local test site, invitations, Stripe webhooks, uploads, reports, maintenance mode, admin MFA, the sign-up gate and session revocation. It exercises the full HTTP stack with real JWKS-signed tokens.

## Schema changes

Edit `apps/api/prisma/schema.prisma`, then run `npm run db:migrate --workspace apps/api -- --name <change>`. Review the generated SQL before committing. Rules Prisma cannot express (CHECKs, triggers, partial indexes) go in hand-written SQL inside a migration and are documented in `docs/DATA_MODEL.md`. Follow guide §20: expand → backfill → switch → contract.

## CI and deployment

`.github/workflows/ci.yml` runs on pushes and pull requests: `npm ci`, production dependency audit, Prisma validate/generate, typecheck, unit tests, integration tests against a Postgres 16 service, and the production build.

Container images (build from the repository root):

```bash
docker build -f docker/api.Dockerfile -t ampliverify-api .
```

```bash
docker build -f docker/web.Dockerfile -t ampliverify-web .
```

The API image runs `prisma migrate deploy` and then starts the API with the job worker (`JOBS_WORKER=off` on extra replicas that should only serve HTTP). The web image is the Next.js standalone server on port 3000; run `npm run auth:migrate --workspace apps/web` against `AUTH_DATABASE_URL` once per release. Configure both with the variables from the `.env.example` files; never bake secrets into images.
