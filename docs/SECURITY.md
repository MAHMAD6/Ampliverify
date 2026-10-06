# Security model

## Boundaries

- The browser is never an authorization boundary (guide §2).
- Better Auth authenticates the person and issues the API bearer JWT.
- The API verifies the JWT against Better Auth's JWKS (`iss`, `aud`, signature, expiry). It then resolves `sub` to `users.auth_subject` and rejects non-`ACTIVE` or soft-deleted users.
- A valid token grants no permissions by itself. RBAC is checked server-side on every protected operation, against the **server-resolved** scope of the target resource. Client-supplied tenant ids are never trusted alone.

## Privilege-escalation protections

1. No self-assignment and no self-revocation through the API.
2. `admin.access.manage` is required at the target scope.
3. The grantor must already hold every permission in the role, at that scope.
4. The target user must be an active member of the target organization or workspace.
5. Custom roles require global `admin.role.manage`, and may only bundle permissions the creator already holds.
6. Tenant-scoped assignments stop counting as soon as the membership is no longer `ACTIVE`.

## Integrity

- Audit records are written in the same transaction as the mutation they describe. `audit_logs` is append-only at the database layer.
- Credits: an append-only ledger with unique idempotency keys, and a wallet cache maintained by trigger. See `DATA_MODEL.md`.
- Webhooks (later batch): verify signature → insert into `webhook_events` (unique per provider event id) → acknowledge → process asynchronously.

## Secrets and credentials

- No credentials are stored in the repository. `.env` is git-ignored, and `.env.example` holds placeholders only.
- `AUTH_SYNC_SECRET` must be at least 32 characters. It is compared in constant time via SHA-256 digests.
- The first Super Admin is granted with `apps/api/scripts/bootstrap-super-admin.sql`, keyed by the Better Auth subject. Passwords never touch this API.

## Not yet implemented (deliberately not simulated)

MFA / step-up policy, login rate limiting, invitations, session/device management, billing and credit services, SEO/GEO jobs, provider secrets, full pagination, and abuse/risk controls. Launch gates are listed in guide §24.
