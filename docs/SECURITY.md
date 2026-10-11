# Security model

## Boundaries

- The browser is never an authorization boundary (guide §2).
- Better Auth (inside the web app, own database) authenticates the person and issues the API bearer JWT. It uses the jwt plugin with EdDSA keys and a 15-minute expiry. The private keys are encrypted at rest with `BETTER_AUTH_SECRET`.
- Email/password accounts must verify their email before signing in. Password reset revokes existing sessions, and reset requests never reveal whether an email has an account.
- Post-sign-in redirects accept only same-site relative paths (`lib/safe-next.ts`).
- `/app` and `/admin` are gated on the session cookie (`src/proxy.ts`). This is only a UX redirect; the browser is still not an authorization boundary.
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
- Stripe webhooks: verify signature → insert into `webhook_events` (unique per provider event id) → acknowledge → process asynchronously on the job queue.
- Outbound custom-website webhooks are signed (`X-AmpliVerify-Signature: t=…,v1=…`, HMAC-SHA256 over `t.body`).

## Secrets and credentials

- No credentials are stored in the repository. `.env` is git-ignored, and `.env.example` holds placeholders only.
- `AUTH_SYNC_SECRET` must be at least 32 characters. It is compared in constant time via SHA-256 digests.
- The first Super Admin is granted with `apps/api/scripts/bootstrap-super-admin.sql`, keyed by the Better Auth subject. Passwords never touch this API.

## Abuse controls and hardening

- Rate limits: Better Auth limits stored in the auth database (shared across instances; tighter limits on sign-in, sign-up, password reset, verification email and MFA verification). API limit per user or IP (`RATE_LIMIT_PER_MINUTE`), 10/min on public contact and job-application forms. Public forms also use a honeypot.
- MFA (TOTP, backup codes), passkeys, and an admin-MFA policy enforced by the API from the JWT `twoFactorEnabled` claim.
- Sessions and devices can be listed and revoked by the user and by staff; suspension signs a user out everywhere.
- Content-Security-Policy, HSTS, frame denial and related headers on the web app; editor HTML is sanitized with DOMPurify.
- Outbound requests (audits, CMS, webhooks) go through the SSRF-safe fetcher; private addresses are refused in production.
- Provider credentials (CMS, Google) are encrypted at rest with `INTEGRATION_ENCRYPTION_KEY` (32+ characters).
- CSV exports neutralize spreadsheet formulas. Uploaded application files stay undownloadable until a ClamAV scan marks them clean.
- Retention: deleted projects are purged after `PROJECT_PURGE_GRACE_DAYS`; workspace retention settings are applied daily.

## Open before launch

Production hosting, backups, monitoring and alerting, load tests for the crawler and GEO checks, approved legal text, and production provider keys. Launch gates are listed in guide §24.
