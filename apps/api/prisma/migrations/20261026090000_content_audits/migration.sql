CREATE TABLE "content_audits" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "source_run_id" UUID,
  "created_by" UUID NOT NULL,
  "summary_json" JSONB NOT NULL,
  "pages_json" JSONB NOT NULL,
  "ai_json" JSONB,
  "ai_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_audits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "content_audits_project_id_created_at_idx" ON "content_audits"("project_id", "created_at" DESC);

-- Illustrative prices for the new AI operations (OpenAI guide §4); existing admin values win.
UPDATE "system_settings" SET "value_json" = '{"ai.finding_explanation": 2, "ai.article_draft": 10, "ai.geo_recommendations": 5, "ai.content_audit": 5}'::jsonb || "value_json", "updated_at" = now() WHERE "key" = 'credits.costs';
