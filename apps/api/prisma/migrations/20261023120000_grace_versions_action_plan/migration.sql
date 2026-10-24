-- Dunning grace period (Hybrid pricing guide §6).
ALTER TABLE "subscriptions" ADD COLUMN "past_due_since" TIMESTAMPTZ(6);
UPDATE "subscriptions" SET "past_due_since" = "updated_at" WHERE "status" = 'PAST_DUE';

-- Historical entitlement rule sets (Hybrid pricing guide §7).
CREATE TABLE "plan_entitlement_versions" (
  "id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot_json" JSONB NOT NULL,
  "changed_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_entitlement_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plan_entitlement_versions_plan_id_version_key" ON "plan_entitlement_versions"("plan_id", "version");
CREATE OR REPLACE FUNCTION plan_entitlement_versions_immutable() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'plan_entitlement_versions are append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER plan_entitlement_versions_no_update BEFORE UPDATE OR DELETE ON "plan_entitlement_versions" FOR EACH ROW EXECUTE FUNCTION plan_entitlement_versions_immutable();

-- Baseline version for every plan that has entitlements today.
INSERT INTO "plan_entitlement_versions" ("id", "plan_id", "version", "snapshot_json")
SELECT gen_random_uuid(), p."id", 1, COALESCE((SELECT jsonb_agg(jsonb_build_object('key', f."key", 'enabled', e."enabled", 'limit', e."limit_numeric"::text, 'config', e."config_json") ORDER BY f."key") FROM "plan_entitlements" e JOIN "features" f ON f."id" = e."feature_id" WHERE e."plan_id" = p."id"), '[]'::jsonb)
  FROM "plans" p;

-- Illustrative prices for the new operations; existing admin values win.
UPDATE "system_settings" SET "value_json" = '{"ai.seo_optimization": 5, "ai.action_plan": 10}'::jsonb || "value_json", "updated_at" = now() WHERE "key" = 'credits.costs';
