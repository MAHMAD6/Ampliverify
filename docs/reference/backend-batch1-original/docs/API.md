# Batch 1 API Surface

All routes are under `/api/v1`.

`GET /health` is intentionally public and returns a minimal process health response; database/provider readiness checks belong to the operations batch.

## Authentication integration

| Method | Route | Purpose |
|---|---|---|
| POST | `/internal/auth/users/sync` | Provision/update the API user from the trusted auth service |

The sync endpoint is server-to-server only and uses `X-Auth-Sync-Secret`.

## Current user / tenant

| Method | Route | Permission |
|---|---|---|
| GET | `/user/me` | Authenticated user |
| GET | `/user/organizations` | Active organization membership |
| POST | `/user/organizations` | Authenticated onboarding action |
| GET | `/user/workspaces?organizationId=...` | Active workspace membership |
| POST | `/user/workspaces` | `workspace.create` at organization scope |

Creating an organization creates a default workspace, active memberships for the creator, and an organization-scoped OWNER role assignment in one transaction.

## Projects

| Method | Route | Permission |
|---|---|---|
| GET | `/user/projects` | Returns only projects covered by `project.read` |
| POST | `/user/projects` | `project.create` at workspace/org scope |
| GET | `/user/projects/:id` | `project.read` |
| PATCH | `/user/projects/:id` | `project.update` |

Batch 1 uses archive status rather than a hard-delete endpoint.

## Super Admin foundation

| Method | Route | Permission |
|---|---|---|
| GET | `/admin/users` | global `user.read` |
| GET | `/admin/users/:id` | global `user.read` |
| GET | `/admin/roles` | global `admin.role.manage` |
| POST | `/admin/roles` | global `admin.role.manage` + permission-subset validation |
| GET | `/admin/access-assignments` | global `admin.access.manage` |
| POST | `/admin/access-assignments` | scope-aware `admin.access.manage` + permission-subset validation |
| POST | `/admin/access-assignments/:id/revoke` | scope-aware `admin.access.manage` + permission-subset validation |
| GET | `/admin/audit-events?limit=100` | global `audit.read` |

## Response envelope

Successful response:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

Failure response:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action."
  }
}
```
