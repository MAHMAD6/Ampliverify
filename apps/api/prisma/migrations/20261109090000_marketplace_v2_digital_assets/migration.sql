-- CreateEnum
CREATE TYPE "marketplace_listing_kind" AS ENUM ('BUSINESS', 'DIGITAL_PRODUCT');

-- CreateEnum
CREATE TYPE "marketplace_url_visibility" AS ENUM ('PUBLIC', 'AFTER_INTRODUCTION', 'AFTER_DILIGENCE');

-- CreateEnum
CREATE TYPE "marketplace_intro_status" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "seller_status" AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "seller_check_status" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "verification_kind" AS ENUM ('IDENTITY', 'BUSINESS', 'PAYOUT', 'OWNERSHIP', 'TRAFFIC', 'FINANCIAL', 'AI_SCREENING');

-- CreateEnum
CREATE TYPE "marketplace_offer_status" AS ENUM ('SUBMITTED', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "marketplace_order_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "entitlement_status" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "seller_ledger_type" AS ENUM ('SALE', 'PLATFORM_FEE', 'REFUND', 'PAYOUT', 'PAYOUT_REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "seller_payout_status" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "marketplace_case_kind" AS ENUM ('REFUND', 'ISSUE', 'DISPUTE');

-- CreateEnum
CREATE TYPE "marketplace_case_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'REFUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "asset_relationship" AS ENUM ('OWNED', 'MANAGED', 'AUTHORIZED', 'PROSPECTIVE');

-- CreateEnum
CREATE TYPE "asset_ownership_status" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "marketplace_listing_status" ADD VALUE 'DRAFT';
ALTER TYPE "marketplace_listing_status" ADD VALUE 'CHANGES_REQUESTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "marketplace_transaction_status" ADD VALUE 'AGREEMENT_PENDING';
ALTER TYPE "marketplace_transaction_status" ADD VALUE 'DUE_DILIGENCE';
ALTER TYPE "marketplace_transaction_status" ADD VALUE 'TRANSFER_IN_PROGRESS';

-- AlterTable
ALTER TABLE "marketplace_listings" ADD COLUMN     "ai_disclosure" TEXT,
ADD COLUMN     "ai_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "highlights" JSONB,
ADD COLUMN     "kind" "marketplace_listing_kind" NOT NULL DEFAULT 'BUSINESS',
ADD COLUMN     "language" TEXT,
ADD COLUMN     "license_terms" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "stage" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMPTZ(6),
ADD COLUMN     "url_visibility" "marketplace_url_visibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "marketplace_inquiries" ADD COLUMN     "budget" TEXT,
ADD COLUMN     "buyer_role" TEXT,
ADD COLUMN     "intro_status" "marketplace_intro_status" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "marketplace_transactions" ADD COLUMN     "buyer_agreed_at" TIMESTAMPTZ(6),
ADD COLUMN     "buyer_confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "notes" JSONB,
ADD COLUMN     "offer_id" UUID,
ADD COLUMN     "seller_agreed_at" TIMESTAMPTZ(6),
ADD COLUMN     "transfer_started_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "website" TEXT,
    "location" TEXT,
    "status" "seller_status" NOT NULL DEFAULT 'ONBOARDING',
    "identity_status" "seller_check_status" NOT NULL DEFAULT 'NOT_STARTED',
    "business_status" "seller_check_status" NOT NULL DEFAULT 'NOT_STARTED',
    "payout_status" "seller_check_status" NOT NULL DEFAULT 'NOT_STARTED',
    "stripe_account_id" TEXT,
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_verification_cases" (
    "id" UUID NOT NULL,
    "seller_profile_id" UUID NOT NULL,
    "kind" "verification_kind" NOT NULL,
    "listing_id" UUID,
    "status" "seller_check_status" NOT NULL DEFAULT 'PENDING',
    "details" JSONB,
    "evidence" JSONB,
    "decision_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seller_verification_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing_files" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listing_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_saved_listings" (
    "user_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_saved_listings_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateTable
CREATE TABLE "marketplace_messages" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_offers" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "inquiry_id" UUID,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "marketplace_offer_status" NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "terms" TEXT,
    "last_actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_offer_revisions" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "terms" TEXT,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_offer_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "platform_fee_minor" BIGINT NOT NULL DEFAULT 0,
    "refunded_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "status" "marketplace_order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "checkout_session_id" TEXT,
    "payment_intent_id" TEXT,
    "license_accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "withdrawal_consent_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_download_entitlements" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "status" "entitlement_status" NOT NULL DEFAULT 'ACTIVE',
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_download_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_download_events" (
    "id" UUID NOT NULL,
    "entitlement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_download_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_ledger_entries" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "type" "seller_ledger_type" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "order_id" UUID,
    "payout_id" UUID,
    "case_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "memo" TEXT,
    "created_by" UUID,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_payouts" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "seller_payout_status" NOT NULL DEFAULT 'REQUESTED',
    "idempotency_key" TEXT NOT NULL,
    "provider_transfer_id" TEXT,
    "failure_reason" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "processed_by" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seller_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_cases" (
    "id" UUID NOT NULL,
    "kind" "marketplace_case_kind" NOT NULL,
    "order_id" UUID,
    "transaction_id" UUID,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" "marketplace_case_status" NOT NULL DEFAULT 'OPEN',
    "requested_amount_minor" BIGINT,
    "approved_amount_minor" BIGINT,
    "decision_note" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "provider_refund_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_assets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "domain" CITEXT,
    "asset_type" "marketplace_asset_type" NOT NULL,
    "relationship" "asset_relationship" NOT NULL,
    "ownership_status" "asset_ownership_status" NOT NULL DEFAULT 'UNVERIFIED',
    "verification_token" TEXT NOT NULL,
    "verified_method" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "description" TEXT,
    "category" TEXT,
    "acquired_at" DATE,
    "purchase_price_minor" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "project_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "digital_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_ownership_evidence" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "status" "asset_ownership_status" NOT NULL,
    "detail" TEXT,
    "storage_key" TEXT,
    "filename" TEXT,
    "reviewed_by" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_ownership_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_financial_entries" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "revenue_minor" BIGINT NOT NULL DEFAULT 0,
    "cost_minor" BIGINT NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_financial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acquisition_analyses" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "domain" CITEXT NOT NULL,
    "asset_type" "marketplace_asset_type" NOT NULL,
    "asking_price_minor" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "checks" JSONB NOT NULL,
    "notes" TEXT,
    "valuation_id" UUID,
    "asset_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acquisition_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_user_id_key" ON "seller_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_stripe_account_id_key" ON "seller_profiles"("stripe_account_id");

-- CreateIndex
CREATE INDEX "seller_verification_cases_status_created_at_idx" ON "seller_verification_cases"("status", "created_at");

-- CreateIndex
CREATE INDEX "seller_verification_cases_seller_profile_id_kind_idx" ON "seller_verification_cases"("seller_profile_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listing_files_storage_key_key" ON "marketplace_listing_files"("storage_key");

-- CreateIndex
CREATE INDEX "marketplace_listing_files_listing_id_role_idx" ON "marketplace_listing_files"("listing_id", "role");

-- CreateIndex
CREATE INDEX "marketplace_saved_listings_user_id_created_at_idx" ON "marketplace_saved_listings"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_messages_inquiry_id_created_at_idx" ON "marketplace_messages"("inquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_offers_buyer_id_updated_at_idx" ON "marketplace_offers"("buyer_id", "updated_at");

-- CreateIndex
CREATE INDEX "marketplace_offers_seller_id_updated_at_idx" ON "marketplace_offers"("seller_id", "updated_at");

-- CreateIndex
CREATE INDEX "marketplace_offers_listing_id_idx" ON "marketplace_offers"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_offer_revisions_offer_id_version_action_key" ON "marketplace_offer_revisions"("offer_id", "version", "action");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_checkout_session_id_key" ON "marketplace_orders"("checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_payment_intent_id_key" ON "marketplace_orders"("payment_intent_id");

-- CreateIndex
CREATE INDEX "marketplace_orders_buyer_id_created_at_idx" ON "marketplace_orders"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_orders_seller_id_created_at_idx" ON "marketplace_orders"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_download_entitlements_buyer_id_created_at_idx" ON "marketplace_download_entitlements"("buyer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_download_entitlements_order_id_file_id_key" ON "marketplace_download_entitlements"("order_id", "file_id");

-- CreateIndex
CREATE INDEX "marketplace_download_events_entitlement_id_created_at_idx" ON "marketplace_download_events"("entitlement_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_ledger_entries_idempotency_key_key" ON "seller_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_seller_id_created_at_idx" ON "seller_ledger_entries"("seller_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_payouts_idempotency_key_key" ON "seller_payouts"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "seller_payouts_provider_transfer_id_key" ON "seller_payouts"("provider_transfer_id");

-- CreateIndex
CREATE INDEX "seller_payouts_seller_id_created_at_idx" ON "seller_payouts"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "seller_payouts_status_created_at_idx" ON "seller_payouts"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_cases_provider_refund_id_key" ON "marketplace_cases"("provider_refund_id");

-- CreateIndex
CREATE INDEX "marketplace_cases_buyer_id_created_at_idx" ON "marketplace_cases"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_cases_seller_id_created_at_idx" ON "marketplace_cases"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_cases_status_created_at_idx" ON "marketplace_cases"("status", "created_at");

-- CreateIndex
CREATE INDEX "digital_assets_workspace_id_relationship_created_at_idx" ON "digital_assets"("workspace_id", "relationship", "created_at" DESC);

-- CreateIndex
CREATE INDEX "asset_ownership_evidence_asset_id_created_at_idx" ON "asset_ownership_evidence"("asset_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "asset_financial_entries_asset_id_month_source_key" ON "asset_financial_entries"("asset_id", "month", "source");

-- CreateIndex
CREATE INDEX "acquisition_analyses_workspace_id_created_at_idx" ON "acquisition_analyses"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_slug_key" ON "marketplace_listings"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_transactions_offer_id_key" ON "marketplace_transactions"("offer_id");

-- AddForeignKey
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "marketplace_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_verification_cases" ADD CONSTRAINT "seller_verification_cases_seller_profile_id_fkey" FOREIGN KEY ("seller_profile_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_verification_cases" ADD CONSTRAINT "seller_verification_cases_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_files" ADD CONSTRAINT "marketplace_listing_files_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_saved_listings" ADD CONSTRAINT "marketplace_saved_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_saved_listings" ADD CONSTRAINT "marketplace_saved_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "marketplace_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_offers" ADD CONSTRAINT "marketplace_offers_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_offers" ADD CONSTRAINT "marketplace_offers_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "marketplace_inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_offers" ADD CONSTRAINT "marketplace_offers_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_offers" ADD CONSTRAINT "marketplace_offers_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_offer_revisions" ADD CONSTRAINT "marketplace_offer_revisions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "marketplace_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_download_entitlements" ADD CONSTRAINT "marketplace_download_entitlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_download_entitlements" ADD CONSTRAINT "marketplace_download_entitlements_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "marketplace_listing_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_download_events" ADD CONSTRAINT "marketplace_download_events_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "marketplace_download_entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_cases" ADD CONSTRAINT "marketplace_cases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_cases" ADD CONSTRAINT "marketplace_cases_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_cases" ADD CONSTRAINT "marketplace_cases_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ownership_evidence" ADD CONSTRAINT "asset_ownership_evidence_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "digital_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_financial_entries" ADD CONSTRAINT "asset_financial_entries_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "digital_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_analyses" ADD CONSTRAINT "acquisition_analyses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_analyses" ADD CONSTRAINT "acquisition_analyses_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "digital_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integrity: money columns that must be positive or non-negative.
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_amount_positive" CHECK ("amount_minor" > 0 AND "platform_fee_minor" >= 0 AND "platform_fee_minor" <= "amount_minor" AND "refunded_minor" >= 0 AND "refunded_minor" <= "amount_minor");
ALTER TABLE "marketplace_offers" ADD CONSTRAINT "marketplace_offers_amount_positive" CHECK ("amount_minor" > 0 AND "version" >= 1);
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_amount_positive" CHECK ("amount_minor" > 0);
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_amount_nonzero" CHECK ("amount_minor" <> 0);
ALTER TABLE "marketplace_listing_files" ADD CONSTRAINT "marketplace_listing_files_role" CHECK ("role" IN ('MEDIA', 'DELIVERABLE'));
ALTER TABLE "asset_financial_entries" ADD CONSTRAINT "asset_financial_entries_nonneg" CHECK ("revenue_minor" >= 0 AND "cost_minor" >= 0);

-- The seller ledger is append-only: rows are never edited or removed.
CREATE OR REPLACE FUNCTION seller_ledger_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'seller_ledger_entries is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER seller_ledger_entries_no_update BEFORE UPDATE OR DELETE ON "seller_ledger_entries" FOR EACH ROW EXECUTE FUNCTION seller_ledger_immutable();

-- Payout operations permission (approve / process payouts, adjust balances, marketplace terms).
INSERT INTO "permissions" ("id", "key", "description")
VALUES (gen_random_uuid(), 'marketplace.payouts', 'Admin: approve and process seller payouts, adjust balances')
ON CONFLICT ("key") DO NOTHING;
UPDATE "permissions" SET "description" = 'Admin: marketplace listings, sellers, verification, transactions and cases' WHERE "key" = 'marketplace.manage';
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
 WHERE r."key" = 'SUPER_ADMIN' AND p."key" = 'marketplace.payouts'
ON CONFLICT DO NOTHING;
