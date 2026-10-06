<p align="center">
  <img src="assets/brand/ampliverify-logo.png" alt="AmpliVerify — Audit • Optimize • Verify" width="480">
</p>

# AmpliVerify

Multi-tenant SEO and AI-search (GEO) SaaS: a public site, a user app and a Super Admin console.

This repository currently contains the **backend foundation**: the full PostgreSQL schema and a NestJS API covering auth integration, tenancy, projects, RBAC and immutable audit logging.

```text
apps/
  api/                     NestJS API + Prisma (schema, migrations, tests)
assets/brand/              Logo files
docs/
  AmpliVerify_Database_Architecture_Implementation_Guide.pdf   ← schema source of truth
  DATA_MODEL.md            Schema overview, DB-enforced rules, deviations from the guide
  API.md                   Route list and permissions
  SECURITY.md              Auth / RBAC / audit model
  INPUTS.md                Register of every supplied input file
  design/                  Approved UI mockups (admin, public, user app)
  reference/               Original Backend Batch 1 (NestJS + TypeORM), kept for provenance
```

## Stack

Node.js ≥ 22.12 · NestJS 11 · Prisma 6 · PostgreSQL 16 · Better Auth (JWT/JWKS) · Jest.

## Getting started

```bash
cp apps/api/.env.example apps/api/.env        # fill in Better Auth + AUTH_SYNC_SECRET
docker compose up -d postgres                  # or any PostgreSQL 16
npm install
npm run db:deploy                              # applies migrations (incl. RBAC/feature registries)
npm run start:dev --workspace apps/api         # http://localhost:4000/api/v1
```

First Super Admin: provision the user through `POST /api/v1/internal/auth/users/sync`, then run this once:

```bash
psql "$DATABASE_URL" -v auth_subject='BETTER_AUTH_USER_ID' -f apps/api/scripts/bootstrap-super-admin.sql
```

## Checks

```bash
npm run typecheck
npm test            # unit tests
npm run test:db     # integration tests; rebuilds the database named in TEST_DATABASE_URL (must contain "test")
npm run build
```

The integration suite covers onboarding, cross-tenant denial, RBAC anti-escalation, membership gating, append-only tables, ledger idempotency and reconciliation, and the job-application gate. It also exercises the full HTTP stack with real JWKS-signed tokens.

## Schema changes

Edit `apps/api/prisma/schema.prisma`, then run `npm run db:migrate --workspace apps/api -- --name <change>`. Review the generated SQL before committing. Rules Prisma cannot express (CHECKs, triggers, partial indexes) go in hand-written SQL inside a migration and are documented in `docs/DATA_MODEL.md`. Follow guide §20: expand → backfill → switch → contract.
