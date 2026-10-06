# Data model

The schema lives in `apps/api/prisma/schema.prisma` (110 tables) with migrations in
`apps/api/prisma/migrations/`. It implements the table catalog of the
[Database Architecture & Implementation Guide](./AmpliVerify_Database_Architecture_Implementation_Guide.pdf)
(§22/§22A), merged with the tenancy/RBAC model of Backend Batch 1.

## Conventions (guide §2, §21)

- PostgreSQL 16, Prisma 6. PascalCase models → snake_case tables/columns via `@@map` / `@map`.
- UUID primary keys; `timestamptz(6)` timestamps (UTC); `citext` for emails, slugs, hosts and domains.
- Money = integer minor units (`BigInt`); credits / units = `Decimal(18,4)`.
- Large bodies and raw provider responses live in object storage; rows keep `*_ref` keys plus hashes.
- Secrets are never stored: only `*_secret_ref` / `secret_ref` pointers.
- `onDelete: Restrict` for financial, security and audit history; `Cascade` only for pure child rows.
- Soft delete (`deleted_at`) only where restore is a product need: `users`, `organizations`, `workspaces`, `projects`.

## Tenant hierarchy

```text
Organization ─┬─ Workspace ─┬─ Project ─┬─ Domain ─ Page
              │             │           ├─ audits, editor, content, keywords, GEO, reports
              │             │           └─ ...
              │             ├─ billing (customers, subscriptions, invoices)
              │             ├─ credits (wallet, ledger, purchases, adjustments, usage)
              │             └─ integrations, notifications
              └─ OrganizationMembership      WorkspaceMembership
```

- **The workspace is the data tenant boundary** (guide §3): tenant-owned rows carry `workspace_id`, or reach a workspace through `project_id`.
- Organizations (from Backend Batch 1) group workspaces for ownership and administration.
- `projects` stores both `organization_id` and `workspace_id`. A composite FK `(workspace_id, organization_id) → workspaces(id, organization_id)` makes a mismatched pair impossible.

## Authorization model

```text
role_permissions ─ roles ─ role_assignments(user, scope_type, org | workspace | project)
```

- Scope inheritance: `GLOBAL > ORGANIZATION > WORKSPACE > PROJECT`. The default is deny.
- A tenant-scoped assignment counts only while the user's membership is `ACTIVE`: organization membership for ORGANIZATION scope, workspace membership for WORKSPACE and PROJECT scope.
- System roles are seeded by migration: `SUPER_ADMIN` (all permissions), `OWNER`, `MEMBER`. `ADMIN` and `SUB_ADMIN` exist but intentionally have no permissions until they are configured explicitly.
- RBAC, module controls, feature flags and plan entitlements are separate mechanisms (guide §16).

## Database-enforced rules

Defined in `migrations/*_integrity_constraints_and_registries/migration.sql`:

| Rule | Mechanism |
|---|---|
| `audit_logs`, `admin_activity`, `security_events`, `credit_ledger`, `payment_events` are append-only | `BEFORE UPDATE OR DELETE` trigger |
| `finding_events`, `editor_change_events`, `application_events`, `editor_versions` are never edited | `BEFORE UPDATE` trigger |
| `verification_runs` cannot be deleted directly | trigger (cascades from the parent task still apply) |
| Role assignment targets exactly one scope column | `CHECK ck_role_assignments_scope` |
| One identical *active* role assignment | partial unique index `uq_role_assignments_active` |
| Role assignments can only be revoked, once | trigger `trg_role_assignments_revoke_only` |
| Wallet `balance_cache` = Σ ledger deltas | `AFTER INSERT` trigger on `credit_ledger` |
| Ledger deltas ≠ 0; idempotency key unique | CHECK + unique |
| Credit adjustments: non-zero, applied ⇒ ledger entry, no self-approval | CHECKs |
| One active price per plan/interval/currency; ISO currency codes | partial unique index + CHECK |
| Job applications only for PUBLISHED, live, pre-deadline openings | `BEFORE INSERT` trigger (backstop for the API check) |
| Published CMS / job content has `published_at` | CHECKs |
| Due-schedule, unread-notification and pending-webhook lookups | partial indexes |
| One TOTP / SMS MFA factor per user | partial unique index |

Prisma does not model partial indexes, triggers or CHECKs. It ignores them when diffing (checked with `prisma migrate diff` on Prisma 6.19), but review every generated migration anyway.

Permissions, system roles and the feature registry are seeded **by migration**, so every environment converges without a separate seed step. Add new registry rows in new migrations.

## Additions beyond the guide's catalog

| Table / column | Why |
|---|---|
| `organizations`, `organization_memberships` | Backend Batch 1 tenancy model. |
| `role_assignments` (replaces the guide's `membership_roles`) | Batch 1 scoped grants. Covers platform admins (GLOBAL) and tenant roles in one place. |
| `roles.key` (replaces `workspace_id` / `scope`) | Roles are global permission bundles; where they apply is decided by the assignment scope. |
| `users.auth_subject` | Better Auth JWT `sub` ↔ local user. |
| `audit_logs.actor_role, organization_id, workspace_id, reason, ip_address, device_metadata` | Batch 1 audit fields, merged into the guide's `audit_logs`. |
| `credit_adjustments` | Credits & Adjustments screen: reason codes, notes, secondary approval, reversals. |
| `workspace_entitlement_overrides` | Feature Entitlements screen: explicit, time-bounded per-tenant overrides. |
| `features.module_key` | Module filter in the entitlement matrix. |
| `plans.description`, `plans.is_public` | Plans & Pricing public-visibility control. |
| `job_openings.department, compensation_text, summary, show_on_careers_page, application_deadline, require_resume, require_cover_letter, seo_title, meta_description, closed_at` | Job Opening Editor fields. |
| `blog_posts/guides/help_articles.seo_title, meta_description, excerpt`; `blog_posts.featured_media_id` | Blog editor. |
| `report_schedules.report_type`, `reports.schedule_id` | A schedule must know which report type to generate. |
| `projects.primary_goal` (enum `project_goal`: SEO, CONTENT, GEO, ALL; nullable) | Add Project wizard "Primary Goal" (migration `20261006191720_project_primary_goal`). |

"Scheduled" CMS content is `status = PUBLISHED` with a future `published_at`. Public queries must filter `status = 'PUBLISHED' AND published_at <= now()`.

## Enum values

The guide fixes six enums (`UserStatus`, `WorkspaceStatus`, `MembershipStatus`, `RunStatus`, `PublishStatus`, `SubscriptionStatus`). The other value sets were proposed during implementation; see `schema.prisma`. **Confirm them with product before the first production migration.** Adding a value later is cheap; renaming or removing one needs an expand/contract migration.

## Backend Batch 1 port

The original NestJS + TypeORM package is kept unchanged in `docs/reference/backend-batch1-original/`. The port in `apps/api` keeps its API surface and security model, with these changes:

- TypeORM → Prisma. `audit_events` → the guide's `audit_logs` (column `action` → `event_type`). The admin route `/admin/audit-events` → `/admin/audit-logs`.
- Projects keep `organization_id` + `slug` and the composite FK. `workspaces.slug` is unique per organization.
- Workspace creation also creates the workspace's (empty) credit wallet.
- Membership status now gates tenant-scoped permissions (previously a suspended member kept access).
- Revocation records `revoked_by`, uses a conditional update (safe under concurrency), and the DB blocks any other change to an assignment.
- Auth-sync provisioning and status changes are audited.
- Fixed: `createAssignment` passed TypeORM's `IsNull()` operator as an insert value.
- Fixed: `slugify` turned accented letters into separators (`Crème` → `cre-me`).
- Fixed: `bootstrap-super-admin.sql` exited 0 on failure (`\quit 1` ignores its argument).
- Fixed: invalid UUID path params returned 500. They now return 400 via `ParseUUIDPipe`.
- Unique-constraint races surface as 409 instead of 500. Unexpected errors are logged server-side.
