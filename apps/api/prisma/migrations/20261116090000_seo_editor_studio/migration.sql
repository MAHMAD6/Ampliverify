-- CreateTable
CREATE TABLE "editor_drafts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "metadata" JSONB,
    "media_manifest" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "editor_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_draft_revisions" (
    "id" UUID NOT NULL,
    "draft_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "metadata" JSONB,
    "media_manifest" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_draft_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_cms_connections" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credential_ciphertext" TEXT NOT NULL,
    "host" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_cms_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_cms_publications" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "article_key" TEXT NOT NULL,
    "external_id" TEXT,
    "state" TEXT NOT NULL DEFAULT 'in_progress',
    "url" TEXT,
    "last_error" TEXT,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "editor_cms_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosted_forms" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "schema" JSONB NOT NULL,
    "published_style" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previous_form_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hosted_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosted_form_submissions" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hosted_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_media" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "kind" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "declared_mime" TEXT NOT NULL,
    "detected_mime" TEXT,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "staging_key" TEXT NOT NULL,
    "delivery_key" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "scan_result" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "upload_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "editor_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_asset_references" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_key" TEXT NOT NULL,
    "local_ref" TEXT NOT NULL,
    "media_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_asset_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editor_drafts_workspace_id_updated_at_idx" ON "editor_drafts"("workspace_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "editor_drafts_workspace_id_article_key_key" ON "editor_drafts"("workspace_id", "article_key");

-- CreateIndex
CREATE UNIQUE INDEX "editor_draft_revisions_draft_id_revision_key" ON "editor_draft_revisions"("draft_id", "revision");

-- CreateIndex
CREATE INDEX "editor_cms_connections_workspace_id_idx" ON "editor_cms_connections"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "editor_cms_publications_workspace_id_connection_id_article__key" ON "editor_cms_publications"("workspace_id", "connection_id", "article_key");

-- CreateIndex
CREATE INDEX "hosted_forms_workspace_id_created_at_idx" ON "hosted_forms"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "hosted_form_submissions_workspace_id_form_id_created_at_idx" ON "hosted_form_submissions"("workspace_id", "form_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "editor_media_workspace_id_created_at_idx" ON "editor_media"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "editor_media_state_updated_at_idx" ON "editor_media"("state", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "article_asset_references_workspace_id_article_key_local_ref_key" ON "article_asset_references"("workspace_id", "article_key", "local_ref");

-- AddForeignKey
ALTER TABLE "editor_drafts" ADD CONSTRAINT "editor_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_draft_revisions" ADD CONSTRAINT "editor_draft_revisions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "editor_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_cms_connections" ADD CONSTRAINT "editor_cms_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_cms_publications" ADD CONSTRAINT "editor_cms_publications_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "editor_cms_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_forms" ADD CONSTRAINT "hosted_forms_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_form_submissions" ADD CONSTRAINT "hosted_form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "hosted_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_media" ADD CONSTRAINT "editor_media_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_asset_references" ADD CONSTRAINT "article_asset_references_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "editor_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Editor Studio role semantics (guide section 3), mapped onto workspace RBAC:
-- viewer = editor.read, editor = editor.write, publisher = editor.publish,
-- admin = integration.manage (CMS connections) + editor.forms.manage (forms and submissions).
INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'editor.publish',      'Publish editor articles live to connected CMS destinations'),
  (gen_random_uuid(), 'editor.forms.manage', 'Deactivate hosted forms and read form submissions')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r
  JOIN "permissions" p ON p."key" IN ('editor.publish', 'editor.forms.manage')
 WHERE r."key" IN ('SUPER_ADMIN', 'OWNER')
ON CONFLICT DO NOTHING;
