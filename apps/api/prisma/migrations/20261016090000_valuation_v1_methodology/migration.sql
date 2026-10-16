-- Website Value Calculator V1 manual: job states, idempotency,
-- versioned methodology, per-signal evidence, quality score / confidence grade,
-- evidence-gated monetary range; provider cache; credit reservations.

-- Job states (manual §09).
ALTER TYPE "ValuationStatus" RENAME VALUE 'PENDING' TO 'QUEUED';
ALTER TYPE "ValuationStatus" RENAME VALUE 'RUNNING' TO 'COLLECTING';
ALTER TYPE "ValuationStatus" ADD VALUE 'NORMALIZING' AFTER 'COLLECTING';
ALTER TYPE "ValuationStatus" ADD VALUE 'CALCULATING' AFTER 'NORMALIZING';
ALTER TYPE "ValuationStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "ValuationStatus" ADD VALUE 'EXPIRED';
ALTER TABLE "website_valuations" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- Earlier results used a traffic-multiplier USD model that the V1 manual
-- forbids; they are not carried forward.
DELETE FROM "website_valuations";

ALTER TABLE "website_valuations" DROP CONSTRAINT IF EXISTS "website_valuations_confidence_check";
ALTER TABLE "website_valuations" DROP COLUMN "value_mid";
ALTER TABLE "website_valuations" DROP COLUMN "confidence";
ALTER TABLE "website_valuations"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "consent_version" TEXT,
  ADD COLUMN "methodology_version" TEXT,
  ADD COLUMN "quality_score" INTEGER,
  ADD COLUMN "confidence_grade" TEXT,
  ADD COLUMN "evidence_coverage_pct" INTEGER,
  ADD COLUMN "limitations_json" JSONB,
  ADD COLUMN "reservation_id" UUID,
  ADD COLUMN "expires_at" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX "website_valuations_idempotency_key_key" ON "website_valuations"("idempotency_key");
ALTER TABLE "website_valuations" ADD CONSTRAINT "website_valuations_quality_score_check" CHECK ("quality_score" IS NULL OR "quality_score" BETWEEN 0 AND 100);
ALTER TABLE "website_valuations" ADD CONSTRAINT "website_valuations_confidence_grade_check" CHECK ("confidence_grade" IS NULL OR "confidence_grade" IN ('LOW', 'MEDIUM', 'HIGH'));

CREATE TABLE "valuation_methodologies" (
  "id" UUID NOT NULL,
  "version" TEXT NOT NULL,
  "config_json" JSONB NOT NULL,
  "checksum" TEXT NOT NULL,
  "approver_id" UUID,
  "note" TEXT,
  "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "valuation_methodologies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "valuation_methodologies_version_key" ON "valuation_methodologies"("version");
CREATE INDEX "valuation_methodologies_effective_at_idx" ON "valuation_methodologies"("effective_at" DESC);

CREATE TABLE "valuation_evidence" (
  "id" UUID NOT NULL,
  "valuation_id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value_json" JSONB,
  "unit" TEXT,
  "classification" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "observed_at" TIMESTAMPTZ(6) NOT NULL,
  "period_start" TIMESTAMPTZ(6),
  "period_end" TIMESTAMPTZ(6),
  "missing_reason" TEXT,
  "raw_hash" TEXT,
  CONSTRAINT "valuation_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "valuation_evidence_status_check" CHECK ("status" IN ('available', 'unavailable')),
  CONSTRAINT "valuation_evidence_class_check" CHECK ("classification" IN ('observed', 'modeled', 'verified', 'self_reported', 'public_record'))
);
CREATE INDEX "valuation_evidence_valuation_id_idx" ON "valuation_evidence"("valuation_id");
ALTER TABLE "valuation_evidence" ADD CONSTRAINT "valuation_evidence_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "website_valuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "provider_cache" (
  "key" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "value_json" JSONB NOT NULL,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "provider_cache_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "provider_cache_expires_at_idx" ON "provider_cache"("expires_at");

CREATE TYPE "CreditReservationStatus" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED');
CREATE TABLE "credit_reservations" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "feature_key" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "status" "CreditReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "reference_type" TEXT NOT NULL,
  "reference_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMPTZ(6),
  CONSTRAINT "credit_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_reservations_amount_check" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "credit_reservations_idempotency_key_key" ON "credit_reservations"("idempotency_key");
CREATE INDEX "credit_reservations_workspace_id_status_idx" ON "credit_reservations"("workspace_id", "status");
CREATE INDEX "credit_reservations_status_expires_at_idx" ON "credit_reservations"("status", "expires_at");

-- Completed results are immutable (manual §01, §10): only the status may move
-- to EXPIRED afterwards. Methodology versions are append-only.
CREATE FUNCTION "valuation_results_immutable"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'COMPLETED' AND (
       NEW."result_json" IS DISTINCT FROM OLD."result_json" OR NEW."quality_score" IS DISTINCT FROM OLD."quality_score"
    OR NEW."value_low" IS DISTINCT FROM OLD."value_low" OR NEW."value_high" IS DISTINCT FROM OLD."value_high"
    OR NEW."confidence_grade" IS DISTINCT FROM OLD."confidence_grade" OR NEW."methodology_version" IS DISTINCT FROM OLD."methodology_version"
    OR NEW."limitations_json" IS DISTINCT FROM OLD."limitations_json" OR NEW."domain" IS DISTINCT FROM OLD."domain"
    OR (NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" <> 'EXPIRED')) THEN
    RAISE EXCEPTION 'completed valuation results are immutable';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "website_valuations_immutable" BEFORE UPDATE ON "website_valuations" FOR EACH ROW EXECUTE FUNCTION "valuation_results_immutable"();

CREATE FUNCTION "valuation_methodologies_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'valuation methodology versions are append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "valuation_methodologies_no_update" BEFORE UPDATE OR DELETE ON "valuation_methodologies" FOR EACH ROW EXECUTE FUNCTION "valuation_methodologies_append_only"();
