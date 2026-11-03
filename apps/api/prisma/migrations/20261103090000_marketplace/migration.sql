-- CreateEnum
CREATE TYPE "marketplace_asset_type" AS ENUM ('WEBSITE', 'DOMAIN', 'CONTENT_SITE', 'ECOMMERCE', 'SAAS', 'APP', 'OTHER');

-- CreateEnum
CREATE TYPE "marketplace_listing_status" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'WITHDRAWN', 'SOLD');

-- CreateEnum
CREATE TYPE "marketplace_inquiry_status" AS ENUM ('OPEN', 'REPLIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "marketplace_transaction_status" AS ENUM ('PENDING', 'IN_ESCROW', 'COMPLETED', 'CANCELED', 'REFUNDED');

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "asset_type" "marketplace_asset_type" NOT NULL,
    "url" TEXT,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "asking_price_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "monthly_revenue_minor" BIGINT,
    "monthly_visitors" INTEGER,
    "status" "marketplace_listing_status" NOT NULL DEFAULT 'PENDING_REVIEW',
    "review_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_inquiries" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "replied_at" TIMESTAMPTZ(6),
    "status" "marketplace_inquiry_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_transactions" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "marketplace_transaction_status" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_payment_id" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_listings_status_published_at_idx" ON "marketplace_listings"("status", "published_at");

-- CreateIndex
CREATE INDEX "marketplace_listings_seller_id_created_at_idx" ON "marketplace_listings"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_inquiries_listing_id_created_at_idx" ON "marketplace_inquiries"("listing_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_inquiries_buyer_id_created_at_idx" ON "marketplace_inquiries"("buyer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_transactions_provider_payment_id_key" ON "marketplace_transactions"("provider_payment_id");

-- CreateIndex
CREATE INDEX "marketplace_transactions_buyer_id_created_at_idx" ON "marketplace_transactions"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_transactions_seller_id_created_at_idx" ON "marketplace_transactions"("seller_id", "created_at");

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_inquiries" ADD CONSTRAINT "marketplace_inquiries_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_inquiries" ADD CONSTRAINT "marketplace_inquiries_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_inquiries" ADD CONSTRAINT "marketplace_inquiries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity: positive amounts, bounded text.
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_price_positive" CHECK ("asking_price_minor" > 0);
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_revenue_nonneg" CHECK ("monthly_revenue_minor" IS NULL OR "monthly_revenue_minor" >= 0);
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_visitors_nonneg" CHECK ("monthly_visitors" IS NULL OR "monthly_visitors" >= 0);
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_amount_positive" CHECK ("amount_minor" > 0);

-- Admin permission to review marketplace listings; SUPER_ADMIN holds every permission.
INSERT INTO "permissions" ("id", "key", "description")
VALUES (gen_random_uuid(), 'marketplace.manage', 'Admin: review marketplace listings')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
 WHERE r."key" = 'SUPER_ADMIN' AND p."key" = 'marketplace.manage'
ON CONFLICT DO NOTHING;
