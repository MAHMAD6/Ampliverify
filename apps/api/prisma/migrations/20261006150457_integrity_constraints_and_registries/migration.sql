-- Hand-written integrity rules that Prisma's schema language cannot express:
-- CHECK constraints, partial indexes, append-only triggers and the versioned
-- RBAC / feature registries. Keep this file in sync with
-- docs/DATA_MODEL.md ("Database-enforced rules").
--
-- Prisma does not model partial/expression indexes, triggers or CHECKs; it
-- ignores them when diffing (verified with `prisma migrate diff`, Prisma 6.19).
-- Still review generated migrations for unexpected DROP statements.

-- ─────────────────────────────────────────────────────────────────────────────
-- Generic append-only guards
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION av_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- Fully immutable history (no UPDATE, no DELETE).
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

CREATE TRIGGER trg_admin_activity_append_only
  BEFORE UPDATE OR DELETE ON "admin_activity"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

CREATE TRIGGER trg_security_events_append_only
  BEFORE UPDATE OR DELETE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

CREATE TRIGGER trg_credit_ledger_append_only
  BEFORE UPDATE OR DELETE ON "credit_ledger"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

CREATE TRIGGER trg_payment_events_append_only
  BEFORE UPDATE OR DELETE ON "payment_events"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

-- Child history: rows are never edited, but may be removed together with their
-- parent by the policy-aware retention workflow (ON DELETE CASCADE).
CREATE TRIGGER trg_finding_events_no_update
  BEFORE UPDATE ON "finding_events"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

CREATE TRIGGER trg_editor_change_events_no_update
  BEFORE UPDATE ON "editor_change_events"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

CREATE TRIGGER trg_application_events_no_update
  BEFORE UPDATE ON "application_events"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

CREATE TRIGGER trg_editor_versions_no_update
  BEFORE UPDATE ON "editor_versions"
  FOR EACH ROW EXECUTE FUNCTION av_reject_mutation();

CREATE TRIGGER trg_verification_runs_no_delete
  BEFORE DELETE ON "verification_runs"
  FOR EACH ROW WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION av_reject_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- RBAC: scoped role assignments
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "role_assignments" ADD CONSTRAINT "ck_role_assignments_scope" CHECK (
  ("scope_type" = 'GLOBAL'       AND "organization_id" IS NULL     AND "workspace_id" IS NULL     AND "project_id" IS NULL) OR
  ("scope_type" = 'ORGANIZATION' AND "organization_id" IS NOT NULL AND "workspace_id" IS NULL     AND "project_id" IS NULL) OR
  ("scope_type" = 'WORKSPACE'    AND "organization_id" IS NULL     AND "workspace_id" IS NOT NULL AND "project_id" IS NULL) OR
  ("scope_type" = 'PROJECT'      AND "organization_id" IS NULL     AND "workspace_id" IS NULL     AND "project_id" IS NOT NULL)
);

ALTER TABLE "role_assignments" ADD CONSTRAINT "ck_role_assignments_revocation" CHECK (
  ("revoked_at" IS NULL AND "revoked_by" IS NULL) OR "revoked_at" IS NOT NULL
);

-- At most one identical *active* assignment.
CREATE UNIQUE INDEX "uq_role_assignments_active" ON "role_assignments" (
  "user_id", "role_id", "scope_type",
  COALESCE("organization_id", '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE("workspace_id",    '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE("project_id",      '00000000-0000-0000-0000-000000000000'::uuid)
) WHERE "revoked_at" IS NULL;

-- Assignments are revoked, never edited: only revoked_at / revoked_by may be set,
-- and only once.
CREATE OR REPLACE FUNCTION av_role_assignment_revoke_only() RETURNS trigger AS $$
BEGIN
  IF OLD."revoked_at" IS NOT NULL
     OR NEW."id"              IS DISTINCT FROM OLD."id"
     OR NEW."user_id"         IS DISTINCT FROM OLD."user_id"
     OR NEW."role_id"         IS DISTINCT FROM OLD."role_id"
     OR NEW."scope_type"      IS DISTINCT FROM OLD."scope_type"
     OR NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
     OR NEW."workspace_id"    IS DISTINCT FROM OLD."workspace_id"
     OR NEW."project_id"      IS DISTINCT FROM OLD."project_id"
     OR NEW."created_by"      IS DISTINCT FROM OLD."created_by"
     OR NEW."created_at"      IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'role_assignments rows can only be revoked once'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_role_assignments_revoke_only
  BEFORE UPDATE ON "role_assignments"
  FOR EACH ROW EXECUTE FUNCTION av_role_assignment_revoke_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity
-- ─────────────────────────────────────────────────────────────────────────────

-- One TOTP / SMS factor per user; WebAuthn and backup codes may be multiple.
CREATE UNIQUE INDEX "uq_mfa_factors_single_type" ON "mfa_factors" ("user_id", "type")
  WHERE "type" IN ('TOTP', 'SMS');

-- ─────────────────────────────────────────────────────────────────────────────
-- Credits — ledger keeps the wallet cache in step inside the same transaction.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "credit_ledger" ADD CONSTRAINT "ck_credit_ledger_delta_nonzero" CHECK ("delta" <> 0);
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "ck_credit_adjustments_amount_nonzero" CHECK ("amount" <> 0);
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "ck_credit_adjustments_applied_has_entry" CHECK (
  "status" NOT IN ('APPLIED', 'REVERSED') OR "ledger_entry_id" IS NOT NULL
);
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "ck_credit_adjustments_no_self_approval" CHECK (
  "approved_by" IS NULL OR "approved_by" <> "requested_by"
);
ALTER TABLE "credit_purchases" ADD CONSTRAINT "ck_credit_purchases_positive" CHECK ("credits" > 0 AND "amount_minor" >= 0);
ALTER TABLE "usage_events" ADD CONSTRAINT "ck_usage_events_units_nonnegative" CHECK ("units" >= 0);

CREATE OR REPLACE FUNCTION av_credit_ledger_apply_to_wallet() RETURNS trigger AS $$
BEGIN
  UPDATE "credit_wallets"
     SET "balance_cache" = "balance_cache" + NEW."delta",
         "updated_at" = now()
   WHERE "id" = NEW."wallet_id";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_ledger_apply_to_wallet
  AFTER INSERT ON "credit_ledger"
  FOR EACH ROW EXECUTE FUNCTION av_credit_ledger_apply_to_wallet();

-- ─────────────────────────────────────────────────────────────────────────────
-- Billing & entitlements
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "plan_prices" ADD CONSTRAINT "ck_plan_prices_amount_nonnegative" CHECK ("amount_minor" >= 0);
ALTER TABLE "plan_prices" ADD CONSTRAINT "ck_plan_prices_currency" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_currency" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "credit_purchases" ADD CONSTRAINT "ck_credit_purchases_currency" CHECK ("currency" ~ '^[A-Z]{3}$');

-- One active price per plan / interval / currency; inactive prices are history.
CREATE UNIQUE INDEX "uq_plan_prices_active" ON "plan_prices" ("plan_id", "billing_interval", "currency")
  WHERE "active";

ALTER TABLE "subscriptions" ADD CONSTRAINT "ck_subscriptions_period" CHECK ("current_period_end" > "current_period_start");
ALTER TABLE "subscription_items" ADD CONSTRAINT "ck_subscription_items_quantity" CHECK ("quantity" > 0);

ALTER TABLE "workspace_entitlement_overrides" ADD CONSTRAINT "ck_entitlement_overrides_window" CHECK (
  "ends_at" IS NULL OR "ends_at" > "starts_at"
);

ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "ck_feature_flag_rules_percentage" CHECK (
  "percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Scheduling / notifications partial indexes (guide §18)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX "idx_geo_prompt_schedules_due" ON "geo_prompt_schedules" ("next_run_at") WHERE "enabled";
CREATE INDEX "idx_report_schedules_due" ON "report_schedules" ("next_run_at") WHERE "enabled";
CREATE INDEX "idx_notifications_unread" ON "notifications" ("user_id", "created_at" DESC) WHERE "read_at" IS NULL;
CREATE INDEX "idx_webhook_events_pending" ON "webhook_events" ("received_at") WHERE "status" IN ('RECEIVED', 'FAILED');

-- ─────────────────────────────────────────────────────────────────────────────
-- Public CMS & careers
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "blog_posts" ADD CONSTRAINT "ck_blog_posts_published_at" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
ALTER TABLE "guides" ADD CONSTRAINT "ck_guides_published_at" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
ALTER TABLE "help_articles" ADD CONSTRAINT "ck_help_articles_published_at" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
ALTER TABLE "job_openings" ADD CONSTRAINT "ck_job_openings_published_at" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);

-- Backstop for guide §15: an application can only be submitted while the job
-- is published, past its publish time and before its deadline. The API must
-- still validate this; the trigger closes the race between check and insert.
CREATE OR REPLACE FUNCTION av_job_application_requires_open_job() RETURNS trigger AS $$
DECLARE
  job RECORD;
BEGIN
  SELECT "status", "published_at", "application_deadline"
    INTO job
    FROM "job_openings"
   WHERE "id" = NEW."job_id"
   FOR SHARE;

  IF job IS NULL
     OR job."status" <> 'PUBLISHED'
     OR job."published_at" > now()
     OR (job."application_deadline" IS NOT NULL AND job."application_deadline" <= now()) THEN
    RAISE EXCEPTION 'job opening % is not accepting applications', NEW."job_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_job_applications_open_job
  BEFORE INSERT ON "job_applications"
  FOR EACH ROW EXECUTE FUNCTION av_job_application_requires_open_job();

ALTER TABLE "applicant_files" ADD CONSTRAINT "ck_applicant_files_size" CHECK ("size_bytes" > 0);
ALTER TABLE "media_assets" ADD CONSTRAINT "ck_media_assets_size" CHECK ("size_bytes" > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- Versioned registries. New permissions / roles / features ship in new
-- migrations so every environment converges without a separate seed step.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'user.read',           'Read user records'),
  (gen_random_uuid(), 'organization.read',   'Read organization records'),
  (gen_random_uuid(), 'workspace.read',      'Read workspace records'),
  (gen_random_uuid(), 'workspace.create',    'Create workspaces'),
  (gen_random_uuid(), 'project.create',      'Create projects'),
  (gen_random_uuid(), 'project.read',        'Read projects'),
  (gen_random_uuid(), 'project.update',      'Update projects'),
  (gen_random_uuid(), 'project.delete',      'Archive or delete projects'),
  (gen_random_uuid(), 'admin.role.manage',   'Manage roles and role permissions'),
  (gen_random_uuid(), 'admin.access.manage', 'Create and revoke access assignments'),
  (gen_random_uuid(), 'audit.read',          'Read immutable audit logs')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "roles" ("id", "key", "name", "description", "is_system", "updated_at") VALUES
  (gen_random_uuid(), 'SUPER_ADMIN', 'Super Admin', 'Full platform administration.', true, now()),
  (gen_random_uuid(), 'ADMIN',       'Admin',       'Platform administrator. Permissions are configured explicitly.', true, now()),
  (gen_random_uuid(), 'SUB_ADMIN',   'Sub-Admin',   'Restricted platform administrator. Permissions are configured explicitly.', true, now()),
  (gen_random_uuid(), 'OWNER',       'Owner',       'Tenant owner: manages workspaces and projects.', true, now()),
  (gen_random_uuid(), 'MEMBER',      'Member',      'Tenant member with read access.', true, now())
ON CONFLICT ("key") DO NOTHING;

-- SUPER_ADMIN: every permission.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
 WHERE r."key" = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r
  JOIN "permissions" p ON p."key" IN (
    'organization.read', 'workspace.read', 'workspace.create',
    'project.create', 'project.read', 'project.update', 'project.delete')
 WHERE r."key" = 'OWNER'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r
  JOIN "permissions" p ON p."key" IN ('organization.read', 'workspace.read', 'project.read')
 WHERE r."key" = 'MEMBER'
ON CONFLICT DO NOTHING;

-- ADMIN / SUB_ADMIN intentionally receive no implicit permissions.

-- Product capability registry used by the Feature Entitlements matrix. These
-- are capability keys only — no plan, price or limit values are seeded.
INSERT INTO "features" ("id", "key", "name", "module_key", "value_type") VALUES
  (gen_random_uuid(), 'seo.on_page_audit',   'On-Page SEO Audit',   'seo_audit',   'BOOLEAN'),
  (gen_random_uuid(), 'seo.on_page_editor',  'On-Page SEO Editor',  'seo_editor',  'BOOLEAN'),
  (gen_random_uuid(), 'content.audit',       'Content Audit',       'content',     'BOOLEAN'),
  (gen_random_uuid(), 'geo.audit',           'GEO Audit',           'geo',         'BOOLEAN'),
  (gen_random_uuid(), 'ai.suggest',          'AI Suggest',          'ai',          'BOOLEAN'),
  (gen_random_uuid(), 'reports.scheduled',   'Scheduled Reports',   'reports',     'BOOLEAN'),
  (gen_random_uuid(), 'limit.audit_runs',    'Audit runs',          'seo_audit',   'LIMIT'),
  (gen_random_uuid(), 'limit.geo_queries',   'GEO queries',         'geo',         'LIMIT'),
  (gen_random_uuid(), 'limit.ai_actions',    'AI-assisted actions', 'ai',          'LIMIT'),
  (gen_random_uuid(), 'limit.projects',      'Projects',            'workspace',   'LIMIT')
ON CONFLICT ("key") DO NOTHING;
