-- Data source selection (Search Console property, GA4 property, WordPress site) and sync time.
ALTER TABLE "project_data_sources" ADD COLUMN "config_json" JSONB,
ADD COLUMN "last_sync_at" TIMESTAMPTZ(6);
