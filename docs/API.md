# API surface

All routes are under `/api/v1`. Every route requires a Better Auth bearer JWT unless it is listed as public.

## Response envelope

```json
{ "data": {}, "meta": {}, "error": null }
```

```json
{ "data": null, "meta": {}, "error": { "code": "PERMISSION_DENIED", "message": "You do not have permission to perform this action." } }
```

`BigInt` values (money in minor units, byte sizes) are serialized as strings.

## Public

| Method | Route | Notes |
|---|---|---|
| GET | `/health` | Process liveness only. Database and provider readiness belong to the operations batch. |
| POST | `/internal/auth/users/sync` | Server-to-server only. Requires the `X-Auth-Sync-Secret` header. Provisions or updates a user from Better Auth. |

## Public content (no auth)

Every endpoint applies the publication rule: `status = PUBLISHED AND published_at <= now()`. Careers also require `show_on_careers_page` and a future (or missing) application deadline. Only public fields are returned. Bodies are markdown read from content storage (`STORAGE_DIR` locally).

| Method | Route | Notes |
|---|---|---|
| GET | `/public/plans` | Active, public plans with active prices and entitlements |
| GET | `/public/blog?q=&category=&limit=` | Newest first, max 50 |
| GET | `/public/blog/:slug` | Includes `body`, tags and author |
| GET | `/public/guides`, `/public/guides/:slug` | Same shape as blog |
| GET | `/public/help`, `/public/help/:slug` | Same shape as blog |
| GET | `/public/careers`, `/public/careers/:slug` | Detail includes `description` |
| GET | `/public/categories?type=BLOG\|GUIDE\|HELP` | |
| GET | `/public/integrations` | Active integration providers |
| GET | `/public/geo-platforms` | Active AI search platforms (GEO registry) |

## Current user / tenant

| Method | Route | Permission |
|---|---|---|
| GET | `/user/me` | Authenticated |
| GET | `/user/organizations` | Active organization membership |
| POST | `/user/organizations` | Authenticated. Onboarding: creates org + default workspace + wallet + memberships + OWNER assignment + audit, atomically. |
| GET | `/user/workspaces?organizationId=` | Active workspace membership |
| POST | `/user/workspaces` | `workspace.create` at organization scope |

## Projects

| Method | Route | Permission |
|---|---|---|
| GET | `/user/projects` | Returns only projects covered by `project.read`; each includes `primaryDomain` |
| POST | `/user/projects` | `project.create` at workspace scope. Body: `workspaceId`, `name`, optional `domain` (normalized to a bare host, stored as the first `domains` row in the same transaction; invalid → 400 `INVALID_DOMAIN`), optional `primaryGoal` (`SEO`/`CONTENT`/`GEO`/`ALL`). |
| GET | `/user/projects/:id` | `project.read` |
| PATCH | `/user/projects/:id` | `project.update` (status `ARCHIVED` instead of hard delete) |

## Super Admin

| Method | Route | Permission |
|---|---|---|
| GET | `/admin/users?limit=` | global `user.read` |
| GET | `/admin/users/:id` | global `user.read` |
| GET | `/admin/roles` | global `admin.role.manage` |
| POST | `/admin/roles` | global `admin.role.manage`. The creator must hold every bundled permission. |
| GET | `/admin/access-assignments?limit=` | global `admin.access.manage` |
| POST | `/admin/access-assignments` | `admin.access.manage` at the target scope. The grantor must hold every permission of the role there. No self-assignment. The target must be an active member. |
| POST | `/admin/access-assignments/:id/revoke` | Same as above. No self-revocation. |
| GET | `/admin/audit-logs?limit=` | global `audit.read` |
| GET | `/admin/module-controls` | global `system.read` |
| GET | `/admin/feature-flags` | global `system.read` |

List endpoints cap `limit` at 500 (default 100). Full cursor pagination comes in a later batch.
