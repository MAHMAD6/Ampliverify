-- Permissions for the product modules (audit, optimization, editor, content,
-- keywords, GEO, reports, usage/billing, workspace administration) and the
-- Super Admin write paths (CMS, careers, commerce, credits, platform settings).

INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'seo.audit.run',            'Run SEO / GEO audits'),
  (gen_random_uuid(), 'seo.audit.read',           'Read audit runs, findings and recommendations'),
  (gen_random_uuid(), 'optimization.manage',      'Create and update optimization tasks, change finding status, request verification'),
  (gen_random_uuid(), 'editor.read',              'Read editor documents'),
  (gen_random_uuid(), 'editor.write',             'Create and edit editor documents'),
  (gen_random_uuid(), 'content.read',             'Read content strategy records'),
  (gen_random_uuid(), 'content.write',            'Create and edit content ideas, briefs and plans'),
  (gen_random_uuid(), 'keyword.read',             'Read keyword research, lists and clusters'),
  (gen_random_uuid(), 'keyword.write',            'Run keyword research and manage lists and clusters'),
  (gen_random_uuid(), 'geo.read',                 'Read AI search (GEO) prompts and results'),
  (gen_random_uuid(), 'geo.write',                'Manage GEO prompts and run checks'),
  (gen_random_uuid(), 'report.read',              'Read reports'),
  (gen_random_uuid(), 'report.write',             'Generate, schedule and share reports'),
  (gen_random_uuid(), 'usage.read',               'Read credits and usage'),
  (gen_random_uuid(), 'billing.read',             'Read subscription and invoices'),
  (gen_random_uuid(), 'billing.manage',           'Change plan, buy credits, manage payment'),
  (gen_random_uuid(), 'workspace.update',         'Update workspace settings'),
  (gen_random_uuid(), 'workspace.member.manage',  'Invite, update and remove workspace members'),
  (gen_random_uuid(), 'integration.manage',       'Connect and disconnect integrations'),
  (gen_random_uuid(), 'cms.manage',               'Admin: manage public content (blog, guides, help, media)'),
  (gen_random_uuid(), 'careers.manage',           'Admin: manage job openings and applications'),
  (gen_random_uuid(), 'commerce.manage',          'Admin: manage plans, prices, entitlements and subscriptions'),
  (gen_random_uuid(), 'credit.adjust',            'Admin: adjust workspace credit balances'),
  (gen_random_uuid(), 'system.manage',            'Admin: manage module controls, feature flags and platform settings'),
  (gen_random_uuid(), 'user.manage',              'Admin: suspend and reactivate users')
ON CONFLICT ("key") DO NOTHING;

-- SUPER_ADMIN holds every permission.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
 WHERE r."key" = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- OWNER: every tenant permission.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r
  JOIN "permissions" p ON p."key" IN (
    'seo.audit.run', 'seo.audit.read', 'optimization.manage',
    'editor.read', 'editor.write', 'content.read', 'content.write',
    'keyword.read', 'keyword.write', 'geo.read', 'geo.write',
    'report.read', 'report.write', 'usage.read', 'billing.read', 'billing.manage',
    'workspace.update', 'workspace.member.manage', 'integration.manage')
 WHERE r."key" = 'OWNER'
ON CONFLICT DO NOTHING;

-- MEMBER: read access to product data.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r
  JOIN "permissions" p ON p."key" IN (
    'seo.audit.read', 'editor.read', 'content.read', 'keyword.read',
    'geo.read', 'report.read', 'usage.read')
 WHERE r."key" = 'MEMBER'
ON CONFLICT DO NOTHING;
