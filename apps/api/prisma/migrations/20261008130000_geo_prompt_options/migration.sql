-- Per-prompt GEO options: platforms to check, answer locale and tags.
ALTER TABLE "geo_prompts" ADD COLUMN "platform_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "country" TEXT,
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
