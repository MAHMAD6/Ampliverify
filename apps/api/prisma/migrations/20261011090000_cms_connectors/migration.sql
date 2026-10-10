-- CMS connectors beyond WordPress: Webflow (CMS collection), Shopify (pages /
-- blog articles) and a signed webhook to a customer endpoint ("Custom (API)").
INSERT INTO "integration_providers" ("id", "key", "name", "auth_type", "active", "scopes_json") VALUES
  (gen_random_uuid(), 'webflow',        'Webflow',      'API_TOKEN', true, null),
  (gen_random_uuid(), 'shopify',        'Shopify',      'API_TOKEN', true, null),
  (gen_random_uuid(), 'custom_webhook', 'Custom (API)', 'WEBHOOK',   true, null)
ON CONFLICT ("key") DO NOTHING;
