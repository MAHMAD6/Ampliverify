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
cp apps/api/.env.example apps/api/.env        # fill in Better Auth + AUTH_SYNC_SECRET
docker compose up -d postgres                  # or any PostgreSQL 16
npm install
npm run db:deploy                              # applies migrations (incl. RBAC/feature registries)
npm run dev:api                                # http://localhost:4000/api/v1
cp apps/web/.env.example apps/web/.env.local   # API_URL
npm run dev:web                                # http://localhost:3000 (site), /app, /admin
```

Sign-in is not wired into the web app yet (no auth screens have been supplied). Until it is, authenticated pages render their signed-out and empty states. The hook point is `apps/web/src/lib/session.ts`.

First Super Admin: provision the user through `POST /api/v1/internal/auth/users/sync`, then run this once:

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
