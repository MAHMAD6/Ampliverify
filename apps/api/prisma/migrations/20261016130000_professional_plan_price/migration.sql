-- V1 API manual §6: Professional = $199/month per approved business rule. The plan is
-- created as a DRAFT (not public) so Super Admin can attach entitlements and the Stripe
-- price before publishing; other plans and amounts are configured in Super Admin.
INSERT INTO "plans" ("id", "code", "name", "status", "is_public", "display_order", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'professional', 'Professional', 'DRAFT', false, 20, now(), now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "plan_prices" ("id", "plan_id", "billing_interval", "currency", "amount_minor", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), p."id", 'MONTHLY', 'USD', 19900, true, now(), now()
  FROM "plans" p
 WHERE p."code" = 'professional'
   AND NOT EXISTS (SELECT 1 FROM "plan_prices" pp WHERE pp."plan_id" = p."id" AND pp."billing_interval" = 'MONTHLY' AND pp."currency" = 'USD' AND pp."active");
