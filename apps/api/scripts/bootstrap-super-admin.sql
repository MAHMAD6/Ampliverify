\set ON_ERROR_STOP on
-- Grants GLOBAL SUPER_ADMIN to the first trusted operator.
--
-- Usage (after `npm run db:deploy` and after the user has been provisioned
-- through POST /api/v1/internal/auth/users/sync):
--
--   psql "$DATABASE_URL" \
--     -v auth_subject='BETTER_AUTH_USER_ID' \
--     -f scripts/bootstrap-super-admin.sql
--
-- Run once. Later access must be granted through the audited admin API, not SQL.
-- No credentials are read or stored by this script.

SELECT EXISTS (
  SELECT 1 FROM users WHERE auth_subject = :'auth_subject' AND status = 'ACTIVE'
) AS user_exists \gset

\if :user_exists
\else
  DO $$ BEGIN RAISE EXCEPTION 'No ACTIVE user with that auth_subject. Provision the user first.'; END $$;
\endif

SELECT EXISTS (SELECT 1 FROM roles WHERE key = 'SUPER_ADMIN') AS role_exists \gset

\if :role_exists
\else
  DO $$ BEGIN RAISE EXCEPTION 'SUPER_ADMIN role is missing. Run the database migrations first.'; END $$;
\endif

BEGIN;

WITH target_user AS (
  SELECT id FROM users WHERE auth_subject = :'auth_subject'
), target_role AS (
  SELECT id FROM roles WHERE key = 'SUPER_ADMIN'
), inserted AS (
  INSERT INTO role_assignments (id, user_id, role_id, scope_type, created_by)
  SELECT gen_random_uuid(), u.id, r.id, 'GLOBAL', u.id
  FROM target_user u CROSS JOIN target_role r
  WHERE NOT EXISTS (
    SELECT 1 FROM role_assignments ra
    WHERE ra.user_id = u.id
      AND ra.role_id = r.id
      AND ra.scope_type = 'GLOBAL'
      AND ra.revoked_at IS NULL
  )
  RETURNING id, user_id
)
INSERT INTO audit_logs (
  id, actor_user_id, actor_role, event_type, target_type, target_id, after_json
)
SELECT
  gen_random_uuid(),
  i.user_id,
  'SUPER_ADMIN',
  'bootstrap.super_admin',
  'role_assignment',
  i.id::text,
  jsonb_build_object('scopeType', 'GLOBAL', 'roleKey', 'SUPER_ADMIN')
FROM inserted i;

COMMIT;

\echo 'SUPER_ADMIN bootstrap complete (no-op if the assignment already existed).'
