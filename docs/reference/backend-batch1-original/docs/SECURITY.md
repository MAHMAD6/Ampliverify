# Batch 1 Security Model

## Security boundaries

- The browser/UI is never an authorization boundary.
- Better Auth authenticates the person and issues the API bearer token.
- NestJS verifies the bearer JWT against Better Auth's JWKS endpoint.
- NestJS resolves the verified JWT `sub` to the local `users.auth_subject` record.
- RBAC is enforced server-side for every protected resource operation.
- Tenant scope is evaluated using organization, workspace, and project context.
- Default authorization behavior is deny.

## Scope inheritance

An assignment may authorize a nested resource:

- `GLOBAL` covers all resources.
- `ORGANIZATION` covers that organization and its workspaces/projects.
- `WORKSPACE` covers that workspace and its projects.
- `PROJECT` covers only that project.

The database constraint permits exactly one scope target for each non-global assignment.

## Privilege-escalation protections

The access-assignment service:

1. Blocks self-assignment.
2. Blocks self-revocation through the standard API.
3. Requires `admin.access.manage` at the target scope.
4. Verifies that the grantor already holds every permission contained in the role at the target scope.
5. Requires the target user to be an active member of the target organization/workspace for tenant-scoped assignments.
6. Audits role assignment creation and revocation.

Custom role creation requires global `admin.role.manage`, and the creator must already possess every permission included in the new role.

## Audit integrity

`audit_events` is append-only. A PostgreSQL trigger rejects UPDATE and DELETE operations at the database layer. Consequential writes implemented in Batch 1 create the audit event inside the same database transaction as the business mutation.

## Auth provisioning

`POST /api/v1/internal/auth/users/sync` is intended only for server-to-server synchronization from the trusted authentication layer. It requires `X-Auth-Sync-Secret`; the secret must be at least 32 characters and is compared using constant-time comparison.

Do not call this endpoint from browser JavaScript.

## Better Auth prerequisite

Better Auth must be configured to issue bearer JWTs intended for the NestJS API and expose the corresponding JWKS endpoint. Configure and verify the exact Better Auth JWT/JWKS mechanism against the version used by the application before deployment. The API expects:

- an issuer matching `BETTER_AUTH_ISSUER`,
- an audience matching `BETTER_AUTH_AUDIENCE`, and
- a `sub` claim matching `users.auth_subject`.

## Production requirements not yet in Batch 1

These are intentionally deferred rather than simulated:

- MFA/step-up authentication policy
- login rate limiting
- invitation workflow
- session/device management
- billing/credits
- SEO crawling jobs
- API provider secrets
- full admin pagination/filtering
- automated abuse/risk controls
