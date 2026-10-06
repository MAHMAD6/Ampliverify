\set ON_ERROR_STOP on
-- Usage:
--   psql "$DATABASE_URL" \
--     -v auth_subject='BETTER_AUTH_USER_ID' \
--     -v actor_email='admin@example.com' \
--     -f scripts/bootstrap-super-admin.sql
--
-- Run only once for the first trusted operator. Later access must be granted
-- through the audited API, not direct SQL.

SELECT EXISTS (
  SELECT 1 FROM users
  WHERE auth_subject = :'auth_subject' OR email = :'actor_email'::citext
) AS user_exists \gset

\if :user_exists
\else
  \echo 'ERROR: User must be provisioned before bootstrap.'
  \quit 1
\endif

SELECT EXISTS (SELECT 1 FROM roles WHERE key = 'SUPER_ADMIN') AS role_exists \gset

\if :role_exists
\else
  \echo 'ERROR: SUPER_ADMIN system role is missing.'
  \quit 1
\endif

BEGIN;

WITH target_user AS (
  SELECT id
  FROM users
  WHERE auth_subject = :'auth_subject' OR email = :'actor_email'::citext
  ORDER BY CASE WHEN auth_subject = :'auth_subject' THEN 0 ELSE 1 END
  LIMIT 1
), target_role AS (
  SELECT id FROM roles WHERE key = 'SUPER_ADMIN'
), inserted AS (
  INSERT INTO role_assignments (user_id, role_id, scope_type, created_by)
  SELECT u.id, r.id, 'GLOBAL', u.id
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
INSERT INTO audit_events (
  actor_user_id, actor_role, action, target_type, target_id, after_state
)
SELECT
  i.user_id,
  'SUPER_ADMIN',
  'bootstrap.super_admin',
  'role_assignment',
  i.id,
  jsonb_build_object('scopeType', 'GLOBAL', 'roleKey', 'SUPER_ADMIN')
FROM inserted i;

COMMIT;
