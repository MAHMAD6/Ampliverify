-- Tax collected by Stripe Tax on digital-product orders (prices exclude tax).
ALTER TABLE "marketplace_orders" ADD COLUMN "tax_minor" BIGINT NOT NULL DEFAULT 0;
