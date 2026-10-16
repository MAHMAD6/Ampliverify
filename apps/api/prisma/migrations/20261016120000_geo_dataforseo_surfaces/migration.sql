-- V1 manual: runs can end PARTIAL (some providers/surfaces failed).
ALTER TYPE "run_status" ADD VALUE IF NOT EXISTS 'PARTIAL' BEFORE 'FAILED';

-- GEO observes Google AI Mode and Google organic results (AI Overview) through DataForSEO.
-- The synthetic LLM platforms are retired: their answers were generated, not observed.
UPDATE "geo_platforms" SET "is_active" = false WHERE "key" IN ('chatgpt', 'claude', 'gemini', 'perplexity');
INSERT INTO "geo_platforms" ("id", "key", "name", "is_active", "capabilities") VALUES
  (gen_random_uuid(), 'google-ai-mode',     'Google AI Mode',     true, '{"provider":"dataforseo","surface":"google_ai_mode"}'),
  (gen_random_uuid(), 'google-ai-overview', 'Google AI Overview', true, '{"provider":"dataforseo","surface":"google_organic"}')
ON CONFLICT ("key") DO UPDATE SET "is_active" = true, "capabilities" = EXCLUDED."capabilities";
