-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "privacy_json" JSONB;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "settings_json" JSONB,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "invited_by" UUID NOT NULL,
    "accepted_by" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'QUEUED',
    "file_ref" TEXT,
    "size_bytes" BIGINT,
    "error" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "company" TEXT,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "ip_hash" TEXT,
    "handled_by" UUID,
    "handled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_videos" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "description" TEXT,
    "video_url" TEXT NOT NULL,
    "thumbnail_id" UUID,
    "duration_sec" INTEGER,
    "status" "publish_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_events" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "summary" TEXT,
    "event_type" TEXT NOT NULL DEFAULT 'WEBINAR',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "location_text" TEXT,
    "registration_url" TEXT,
    "status" "publish_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_studies" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "industry" TEXT,
    "summary" TEXT,
    "body_ref" TEXT NOT NULL,
    "cover_media_id" UUID,
    "results_json" JSONB,
    "seo_title" TEXT,
    "meta_description" TEXT,
    "status" "publish_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_token_hash_key" ON "workspace_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "workspace_invitations_workspace_id_status_idx" ON "workspace_invitations"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "workspace_invitations_email_status_idx" ON "workspace_invitations"("email", "status");

-- CreateIndex
CREATE INDEX "data_export_requests_workspace_id_created_at_idx" ON "data_export_requests"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contact_submissions_status_created_at_idx" ON "contact_submissions"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_workspace_id_status_idx" ON "support_tickets"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_status_updated_at_idx" ON "support_tickets"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_videos_slug_key" ON "cms_videos"("slug");

-- CreateIndex
CREATE INDEX "cms_videos_status_published_at_idx" ON "cms_videos"("status", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cms_events_slug_key" ON "cms_events"("slug");

-- CreateIndex
CREATE INDEX "cms_events_status_starts_at_idx" ON "cms_events"("status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "case_studies_slug_key" ON "case_studies"("slug");

-- CreateIndex
CREATE INDEX "case_studies_status_published_at_idx" ON "case_studies"("status", "published_at" DESC);

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Monthly credit allowance included in a plan (granted on each paid invoice).
INSERT INTO "features" ("id", "key", "name", "module_key", "value_type") VALUES
  (gen_random_uuid(), 'credits.monthly_grant', 'Monthly credits included', 'credits', 'LIMIT'),
  (gen_random_uuid(), 'keywords.research',     'Keyword Research',         'keywords', 'BOOLEAN'),
  (gen_random_uuid(), 'limit.keyword_lookups', 'Keyword lookups',          'keywords', 'LIMIT'),
  (gen_random_uuid(), 'content.strategy',      'Content Strategy',         'content',  'BOOLEAN'),
  (gen_random_uuid(), 'integrations.cms',      'CMS publishing',           'integrations', 'BOOLEAN'),
  (gen_random_uuid(), 'limit.team_members',    'Team members',             'workspace', 'LIMIT')
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "contact_submissions" ADD CONSTRAINT "ck_contact_message_length" CHECK (char_length("message") <= 5000);
ALTER TABLE "case_studies" ADD CONSTRAINT "ck_case_studies_published_at" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
ALTER TABLE "cms_videos" ADD CONSTRAINT "ck_cms_videos_published_at" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
ALTER TABLE "cms_events" ADD CONSTRAINT "ck_cms_events_published_at" CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
