-- Guides gain author, featured image, tags, related guides and display settings;
-- reader comments (moderated), article feedback votes and a double opt-in newsletter.

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SPAM');

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED');

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "allow_comments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reading_minutes" INTEGER,
ADD COLUMN     "show_key_takeaways" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_toc" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "cms_authors" ADD COLUMN     "avatar_media_id" UUID;

-- AlterTable
ALTER TABLE "guides" ADD COLUMN     "allow_comments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "author_id" UUID,
ADD COLUMN     "featured_media_id" UUID,
ADD COLUMN     "reading_minutes" INTEGER,
ADD COLUMN     "show_key_takeaways" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_toc" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "guide_tags" (
    "guide_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "guide_tags_pkey" PRIMARY KEY ("guide_id","tag_id")
);

-- CreateTable
CREATE TABLE "guide_related" (
    "guide_id" UUID NOT NULL,
    "related_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "guide_related_pkey" PRIMARY KEY ("guide_id","related_id")
);

-- CreateTable
CREATE TABLE "article_comments" (
    "id" UUID NOT NULL,
    "content_type" "cms_content_type" NOT NULL,
    "article_id" UUID NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_email" CITEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PENDING',
    "ip_hash" TEXT,
    "moderated_by" UUID,
    "moderated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_feedback" (
    "id" UUID NOT NULL,
    "content_type" "cms_content_type" NOT NULL,
    "article_id" UUID NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "voter_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "article_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "status" "NewsletterStatus" NOT NULL DEFAULT 'PENDING',
    "token_hash" TEXT NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),
    "unsubscribed_at" TIMESTAMPTZ(6),

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_tags_tag_id_idx" ON "guide_tags"("tag_id");

-- CreateIndex
CREATE INDEX "article_comments_content_type_article_id_status_created_at_idx" ON "article_comments"("content_type", "article_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "article_comments_status_created_at_idx" ON "article_comments"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "article_feedback_content_type_article_id_idx" ON "article_feedback"("content_type", "article_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_feedback_content_type_article_id_voter_hash_key" ON "article_feedback"("content_type", "article_id", "voter_hash");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_token_hash_key" ON "newsletter_subscribers"("token_hash");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_created_at_idx" ON "newsletter_subscribers"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "guides_author_id_idx" ON "guides"("author_id");

-- AddForeignKey
ALTER TABLE "cms_authors" ADD CONSTRAINT "cms_authors_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "cms_authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_featured_media_id_fkey" FOREIGN KEY ("featured_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_tags" ADD CONSTRAINT "guide_tags_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_tags" ADD CONSTRAINT "guide_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "cms_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_related" ADD CONSTRAINT "guide_related_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_related" ADD CONSTRAINT "guide_related_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integrity rules Prisma cannot express.
ALTER TABLE "guide_related" ADD CONSTRAINT "guide_related_not_self" CHECK ("guide_id" <> "related_id");
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_type_check" CHECK ("content_type" IN ('BLOG', 'GUIDE'));
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_body_length" CHECK (char_length("body") BETWEEN 2 AND 3000);
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_reading_minutes_check" CHECK ("reading_minutes" IS NULL OR "reading_minutes" BETWEEN 1 AND 600);
ALTER TABLE "guides" ADD CONSTRAINT "guides_reading_minutes_check" CHECK ("reading_minutes" IS NULL OR "reading_minutes" BETWEEN 1 AND 600);
