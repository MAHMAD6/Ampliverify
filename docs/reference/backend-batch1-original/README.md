# AmpliVerify Backend — Batch 1 Foundation

This package implements the first backend foundation for AmpliVerify using NestJS + PostgreSQL + TypeORM, with Better Auth JWT/JWKS integration points.

## Included

- Better Auth bearer JWT verification through JWKS
- trusted auth-user synchronization endpoint
- users
- organizations
- workspaces
- organization/workspace memberships
- projects
- server-side RBAC
- hierarchical authorization scopes
- custom role creation with anti-escalation checks
- access assignment/revocation with anti-escalation checks
- immutable database-backed audit events
- database migration and seed data
- first-Super-Admin bootstrap script
- standardized API success/error envelope
- input validation, CORS allowlist, and security headers

## Not included yet

Batch 1 deliberately does **not** simulate unfinished systems. SEO audits, recommendations, keyword/GEO data, reports, credits, billing, sessions/devices, invitations, MFA policy, feature flags, and system health belong to later batches.

## Architecture

```text
Better Auth
  | JWT + JWKS
  v
NestJS API
  |-- User/Tenant APIs
  |-- Project APIs
  |-- Super Admin foundation
  |-- RBAC policy service
  `-- Audit service
        |
        v
    PostgreSQL
```

## Runtime prerequisite

Use Node.js **22.12 or newer** for this package.

## Quick start

1. Copy environment configuration:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose up -d postgres
```

3. Install dependencies:

```bash
npm install
```

4. Run the migration:

```bash
npm run migration:run
```

5. Configure Better Auth to issue an API bearer JWT and expose its JWKS endpoint. Set the matching issuer, audience, and JWKS URL in `.env`.

6. Provision the first auth user with the internal sync endpoint from trusted server code.

7. Bootstrap the first Super Admin once:

```bash
psql "$DATABASE_URL" \
  -v auth_subject='BETTER_AUTH_USER_ID' \
  -v actor_email='admin@example.com' \
  -f scripts/bootstrap-super-admin.sql
```

8. Start the API:

```bash
npm run start:dev
```

Default API prefix: `http://localhost:4000/api/v1`.

## Authentication contract

The NestJS API expects an `Authorization: Bearer <jwt>` token. JWT validation checks:

- signature against `BETTER_AUTH_JWKS_URL`
- `iss` against `BETTER_AUTH_ISSUER`
- `aud` against `BETTER_AUTH_AUDIENCE`
- `sub` against the provisioned local user's `auth_subject`

A valid auth token does not itself confer application authorization. RBAC checks are separate and server-side.

## Tenant onboarding

`POST /api/v1/user/organizations` is a controlled authenticated onboarding operation. It creates, atomically:

- organization
- default workspace
- organization membership
- workspace membership
- organization-scoped OWNER assignment
- audit event

The OWNER role is seeded with workspace/project permissions. Plan/entitlement limits will be enforced in the commercial-control batch rather than hard-coded here.

## Authorization model

```text
Actor
+ role permissions
+ assignment scope
+ target resource scope
= ALLOW or DENY
```

Scope inheritance:

```text
GLOBAL
  -> ORGANIZATION
      -> WORKSPACE
          -> PROJECT
```

The default outcome is DENY.

A user assigning a role must already hold every permission that role grants at the target scope. This prevents lower actors from creating access they do not themselves possess.

## Audit model

Audit records are immutable at the PostgreSQL layer. UPDATE and DELETE on `audit_events` are rejected by a trigger. Project creation/update, organization/workspace creation, custom role creation, and access assignment/revocation write their audit record inside the same transaction as the mutation.

## Database integrity controls

- case-insensitive unique emails with `citext`
- unique auth subject
- organization/workspace/project foreign keys
- composite project -> workspace/organization consistency constraint
- exactly one target for scoped role assignments
- one active copy of an identical role assignment
- append-only audit table
- migrations only (`synchronize: false`)

## System-role policy

- `SUPER_ADMIN`: all Batch 1 permissions
- `OWNER`: tenant workspace/project management permissions
- `MEMBER`: tenant read permissions
- `ADMIN` / `SUB_ADMIN`: seeded as identities but intentionally receive no guessed/default permission set in this batch

## QA performed for this package

- TypeScript syntax transpile check passed across all source files.
- Migration/entity names and enum names were cross-checked manually.
- Tenant project organization/workspace consistency is enforced in PostgreSQL.
- Permission inheritance and assignment anti-escalation paths were reviewed.
- Sensitive auth synchronization is server-to-server and secret protected.
- No credentials or production data are embedded.

A dependency-backed `npm test` / `npm run build` should also be run in the developer environment after `npm install`, because this execution environment did not have the project dependencies preinstalled.

See `docs/API.md`, `docs/SECURITY.md`, and `docs/DATA_MODEL.md` for handoff details.
