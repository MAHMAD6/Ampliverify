-- Read access to platform operations data (module controls, feature flags) for the Super Admin console.
INSERT INTO "permissions" ("id", "key", "description")
VALUES (gen_random_uuid(), 'system.read', 'Read platform operations data: module controls and feature flags.')
ON CONFLICT ("key") DO NOTHING;

-- SUPER_ADMIN holds every permission.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
 WHERE r."key" = 'SUPER_ADMIN' AND p."key" = 'system.read'
ON CONFLICT DO NOTHING;
