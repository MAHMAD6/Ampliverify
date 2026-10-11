-- Website Value Calculator: valuations (public estimates, verified valuations, admin test runs).
CREATE TYPE "ValuationKind" AS ENUM ('ESTIMATE', 'VERIFIED', 'TEST');
CREATE TYPE "ValuationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "website_valuations" (
  "id" UUID NOT NULL,
  "domain" CITEXT NOT NULL,
  "kind" "ValuationKind" NOT NULL DEFAULT 'ESTIMATE',
  "status" "ValuationStatus" NOT NULL DEFAULT 'PENDING',
  "user_id" UUID,
  "workspace_id" UUID,
  "parent_id" UUID,
  "requester_hash" TEXT,
  "inputs_json" JSONB,
  "result_json" JSONB,
  "value_low" INTEGER,
  "value_high" INTEGER,
  "value_mid" INTEGER,
  "currency" CHAR(3) NOT NULL DEFAULT 'USD',
  "confidence" INTEGER,
  "error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "website_valuations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "website_valuations_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 100),
  CONSTRAINT "website_valuations_range_check" CHECK ("value_low" IS NULL OR "value_high" IS NULL OR "value_low" <= "value_high")
);

CREATE INDEX "website_valuations_domain_created_at_idx" ON "website_valuations"("domain", "created_at" DESC);
CREATE INDEX "website_valuations_user_id_created_at_idx" ON "website_valuations"("user_id", "created_at" DESC);
CREATE INDEX "website_valuations_requester_hash_created_at_idx" ON "website_valuations"("requester_hash", "created_at" DESC);
CREATE INDEX "website_valuations_kind_created_at_idx" ON "website_valuations"("kind", "created_at" DESC);

ALTER TABLE "website_valuations" ADD CONSTRAINT "website_valuations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "website_valuations" ADD CONSTRAINT "website_valuations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "website_valuations" ADD CONSTRAINT "website_valuations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "website_valuations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
