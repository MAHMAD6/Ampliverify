-- Google API Integration Manual V1.1 + Hybrid SEO Allowances / AI-GEO Credits guide.

-- ── Google connections ─────────────────────────────────────────────────────
ALTER TYPE "connection_status" ADD VALUE IF NOT EXISTS 'REAUTH_REQUIRED';

ALTER TABLE "workspace_integrations"
  ADD COLUMN "external_subject_id" TEXT,
  ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "last_error_code" TEXT;

ALTER TABLE "sync_runs"
  ADD COLUMN "data_source_id" UUID,
  ADD COLUMN "sync_key" TEXT,
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rows_upserted" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "data_through" DATE;
CREATE UNIQUE INDEX "sync_runs_sync_key_key" ON "sync_runs"("sync_key");

CREATE TABLE "oauth_transactions" (
  "id" UUID NOT NULL,
  "state_hash" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "code_verifier_sealed" TEXT NOT NULL,
  "return_to" TEXT,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_transactions_state_hash_key" ON "oauth_transactions"("state_hash");
CREATE INDEX "oauth_transactions_expires_at_idx" ON "oauth_transactions"("expires_at");

CREATE TABLE "google_metrics" (
  "id" UUID NOT NULL,
  "data_source_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "dimension" TEXT NOT NULL,
  "dimension_value" TEXT NOT NULL DEFAULT '',
  "clicks" INTEGER,
  "impressions" INTEGER,
  "ctr" DOUBLE PRECISION,
  "position" DOUBLE PRECISION,
  "sessions" INTEGER,
  "active_users" INTEGER,
  "engaged_sessions" INTEGER,
  "conversions" DOUBLE PRECISION,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "google_metrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_metrics_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "project_data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "google_metrics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "google_metrics_data_source_id_source_date_dimension_dimensio_key" ON "google_metrics"("data_source_id", "source", "date", "dimension", "dimension_value");
CREATE INDEX "google_metrics_project_id_source_dimension_date_idx" ON "google_metrics"("project_id", "source", "dimension", "date");

-- ── Allowance reservations and credit lots ─────────────────────────────────
ALTER TABLE "credit_reservations" ADD COLUMN "units" INTEGER NOT NULL DEFAULT 1;

CREATE TYPE "credit_grant_source" AS ENUM ('SUBSCRIPTION', 'SIGNUP', 'PROMOTIONAL', 'ADJUSTMENT', 'PURCHASE');
CREATE TABLE "credit_grants" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "source" "credit_grant_source" NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "ledger_entry_id" UUID NOT NULL,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "expires_at" TIMESTAMPTZ(6),
  "expired_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_grants_amount_positive" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "credit_grants_ledger_entry_id_key" ON "credit_grants"("ledger_entry_id");
CREATE INDEX "credit_grants_workspace_id_expires_at_idx" ON "credit_grants"("workspace_id", "expires_at");

-- Existing positive ledger entries become non-expiring lots.
INSERT INTO "credit_grants" ("id", "workspace_id", "source", "amount", "ledger_entry_id", "reference_type", "reference_id", "created_at")
SELECT gen_random_uuid(), w."workspace_id",
       (CASE l."reason"
          WHEN 'PURCHASE' THEN 'PURCHASE'
          WHEN 'PLAN_GRANT' THEN 'SUBSCRIPTION'
          WHEN 'PROMOTIONAL' THEN 'PROMOTIONAL'
          ELSE 'ADJUSTMENT' END)::"credit_grant_source",
       l."delta", l."id", l."reference_type", l."reference_id"::text, l."created_at"
  FROM "credit_ledger" l JOIN "credit_wallets" w ON w."id" = l."wallet_id"
 WHERE l."delta" > 0 AND l."reason" IN ('PURCHASE', 'PLAN_GRANT', 'PROMOTIONAL', 'ADJUSTMENT_CREDIT')
ON CONFLICT ("ledger_entry_id") DO NOTHING;

-- ── Entitlement features for the hybrid model ──────────────────────────────
INSERT INTO "features" ("id", "key", "name", "module_key", "value_type", "description") VALUES
  (gen_random_uuid(), 'credits.monthly_grant', 'AI/GEO credits per billing period', 'billing', 'LIMIT', 'Subscription credits granted each period; consumed before purchased credits.'),
  (gen_random_uuid(), 'limit.audit_max_pages', 'Max pages per SEO audit', 'seo_audit', 'LIMIT', 'Crawl size cap for one site audit.')
ON CONFLICT ("key") DO NOTHING;

-- ── Planning plans (Hybrid guide §1). Illustrative allocations: created as DRAFT
-- and not public, so Super Admin confirms them before anything is sold. ──────
INSERT INTO "plans" ("id", "code", "name", "description", "status", "is_public", "display_order", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'starter', 'Starter', 'Planning allocation — confirm limits before publishing.', 'DRAFT', false, 10, now(), now()),
  (gen_random_uuid(), 'growth',  'Growth',  'Planning allocation — confirm limits before publishing.', 'DRAFT', false, 15, now(), now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "plan_prices" ("id", "plan_id", "billing_interval", "currency", "amount_minor", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), p."id", 'MONTHLY', 'USD', v.amount, true, now(), now()
  FROM (VALUES ('starter', 2900), ('growth', 7900)) AS v(code, amount)
  JOIN "plans" p ON p."code" = v.code
 WHERE NOT EXISTS (SELECT 1 FROM "plan_prices" pp WHERE pp."plan_id" = p."id" AND pp."billing_interval" = 'MONTHLY' AND pp."currency" = 'USD' AND pp."active");

-- Allowances only where a plan has none yet (never overwrite admin choices).
INSERT INTO "plan_entitlements" ("id", "plan_id", "feature_id", "enabled", "limit_numeric", "updated_at")
SELECT gen_random_uuid(), p."id", f."id", true, v.lim, now()
  FROM (VALUES
          ('starter', 'limit.audit_runs', 100), ('starter', 'credits.monthly_grant', 100), ('starter', 'limit.audit_max_pages', 50),
          ('growth', 'limit.audit_runs', 500), ('growth', 'credits.monthly_grant', 400), ('growth', 'limit.audit_max_pages', 100),
          ('professional', 'limit.audit_runs', 2000), ('professional', 'credits.monthly_grant', 1000), ('professional', 'limit.audit_max_pages', 200)
       ) AS v(code, feature, lim)
  JOIN "plans" p ON p."code" = v.code AND p."status" = 'DRAFT'
  JOIN "features" f ON f."key" = v.feature
ON CONFLICT ("plan_id", "feature_id") DO NOTHING;

-- Illustrative credit schedule (Hybrid guide §3), only when admins have not set one.
-- SEO audits use the audit allowance, never AI/GEO credits.
INSERT INTO "system_settings" ("key", "value_json", "updated_at") VALUES
  ('credits.costs', '{"ai.suggestion": 2, "ai.content_ideas": 5, "ai.content_brief": 5, "geo.check": 5}', now())
ON CONFLICT ("key") DO NOTHING;
