-- AI search platforms monitored by GEO checks. `capabilities.provider` names the
-- API adapter; a platform only runs when its provider key is configured.
INSERT INTO "geo_platforms" ("id", "key", "name", "is_active", "capabilities") VALUES
  (gen_random_uuid(), 'chatgpt',    'ChatGPT',    true, '{"provider":"openai","webSearch":true}'),
  (gen_random_uuid(), 'claude',     'Claude',     true, '{"provider":"anthropic","webSearch":true}'),
  (gen_random_uuid(), 'gemini',     'Gemini',     true, '{"provider":"gemini","webSearch":true}'),
  (gen_random_uuid(), 'perplexity', 'Perplexity', true, '{"provider":"perplexity","webSearch":true}')
ON CONFLICT ("key") DO NOTHING;

-- Integration catalogue. WordPress publishing uses application passwords;
-- Google Search Console / Analytics use OAuth (GOOGLE_OAUTH_CLIENT_ID/SECRET).
INSERT INTO "integration_providers" ("id", "key", "name", "auth_type", "active", "scopes_json") VALUES
  (gen_random_uuid(), 'wordpress',             'WordPress',             'APPLICATION_PASSWORD', true, null),
  (gen_random_uuid(), 'google_search_console', 'Google Search Console', 'OAUTH2', true, '["https://www.googleapis.com/auth/webmasters.readonly"]'),
  (gen_random_uuid(), 'google_analytics',      'Google Analytics 4',    'OAUTH2', true, '["https://www.googleapis.com/auth/analytics.readonly"]')
ON CONFLICT ("key") DO NOTHING;
