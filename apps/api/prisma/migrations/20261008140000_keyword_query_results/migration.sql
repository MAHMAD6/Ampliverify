-- Keyword research runs record which tool ran and where the normalized results live.
ALTER TABLE "keyword_queries" ADD COLUMN "tool" TEXT NOT NULL DEFAULT 'EXPLORER',
ADD COLUMN "result_ref" TEXT,
ADD COLUMN "result_count" INTEGER;

CREATE INDEX "keyword_queries_project_id_tool_created_at_idx" ON "keyword_queries"("project_id", "tool", "created_at" DESC);
