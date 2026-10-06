-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "workspace_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "publish_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "mfa_type" AS ENUM ('TOTP', 'WEBAUTHN', 'SMS', 'BACKUP_CODES');

-- CreateEnum
CREATE TYPE "scope_type" AS ENUM ('GLOBAL', 'ORGANIZATION', 'WORKSPACE', 'PROJECT');

-- CreateEnum
CREATE TYPE "organization_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "connection_status" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "run_trigger" AS ENUM ('MANUAL', 'SCHEDULED', 'API', 'SYSTEM');

-- CreateEnum
CREATE TYPE "finding_severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "finding_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED', 'REGRESSED');

-- CreateEnum
CREATE TYPE "recommendation_source" AS ENUM ('RULE', 'AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "verification_result" AS ENUM ('PASSED', 'FAILED', 'PARTIAL', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "editor_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "suggestion_type" AS ENUM ('CONTENT', 'STRUCTURE', 'KEYWORD', 'METADATA', 'LINK', 'READABILITY', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "suggestion_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "geo_prompt_status" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "result_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "report_type" AS ENUM ('SEO_AUDIT', 'KEYWORD', 'GEO_VISIBILITY', 'CONTENT', 'EXECUTIVE_SUMMARY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "plan_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "billing_interval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "entitlement_value_type" AS ENUM ('BOOLEAN', 'LIMIT', 'CONFIG');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "credit_reason" AS ENUM ('PLAN_GRANT', 'PURCHASE', 'USAGE', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'PROMOTIONAL', 'REFUND', 'REVERSAL', 'EXPIRATION');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "adjustment_type" AS ENUM ('CREDIT', 'DEBIT', 'PROMOTIONAL_CREDIT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "adjustment_status" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED', 'REVERSED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "cms_content_type" AS ENUM ('BLOG', 'GUIDE', 'HELP');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "work_arrangement" AS ENUM ('REMOTE', 'HYBRID', 'ON_SITE');

-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "scan_status" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "webhook_status" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "job_run_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'DEAD');

-- CreateEnum
CREATE TYPE "incident_status" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "health_status" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_subject" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "display_name" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_factors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "mfa_type" NOT NULL,
    "secret_ref" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkeys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "organization_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "workspace_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_memberships" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope_type" "scope_type" NOT NULL,
    "organization_id" UUID,
    "workspace_id" UUID,
    "project_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "project_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "host" CITEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "verification_status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "domain_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "canonical_url" TEXT,
    "http_status" INTEGER,
    "last_seen_at" TIMESTAMPTZ(6),
    "content_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_settings" (
    "project_id" UUID NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "crawl_config" JSONB,
    "seo_defaults" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_settings_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "project_data_sources" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "workspace_integration_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "status" "connection_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_runs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "domain_id" UUID,
    "status" "run_status" NOT NULL DEFAULT 'QUEUED',
    "trigger" "run_trigger" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "summary_json" JSONB,

    CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_pages" (
    "id" UUID NOT NULL,
    "audit_run_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "score" DECIMAL(6,2),
    "metrics_json" JSONB,

    CONSTRAINT "audit_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_findings" (
    "id" UUID NOT NULL,
    "audit_page_id" UUID NOT NULL,
    "rule_key" TEXT NOT NULL,
    "severity" "finding_severity" NOT NULL,
    "status" "finding_status" NOT NULL DEFAULT 'OPEN',
    "fingerprint" TEXT NOT NULL,
    "details_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_recommendations" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "priority" SMALLINT NOT NULL,
    "title" TEXT NOT NULL,
    "guidance" TEXT NOT NULL,
    "source" "recommendation_source" NOT NULL,

    CONSTRAINT "audit_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_events" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimization_tasks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "finding_id" UUID,
    "assigned_to" UUID,
    "title" TEXT NOT NULL,
    "status" "task_status" NOT NULL DEFAULT 'OPEN',
    "priority" SMALLINT NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "optimization_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_runs" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "audit_run_id" UUID,
    "status" "run_status" NOT NULL DEFAULT 'QUEUED',
    "result" "verification_result",
    "evidence_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_documents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "page_id" UUID,
    "title" TEXT NOT NULL,
    "status" "editor_status" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "editor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "content_ref" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_suggestions" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "type" "suggestion_type" NOT NULL,
    "status" "suggestion_status" NOT NULL DEFAULT 'PENDING',
    "suggestion_json" JSONB NOT NULL,
    "model_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "editor_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_change_events" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_change_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_ideas" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_briefs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "primary_keyword_id" UUID,
    "brief_json" JSONB,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_plans" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_plan_items" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "brief_id" UUID,
    "title" TEXT NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'PLANNED',
    "target_date" DATE,

    CONSTRAINT "content_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_queries" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" UUID NOT NULL,
    "normalized_term" CITEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_metric_snapshots" (
    "id" UUID NOT NULL,
    "keyword_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "search_volume" INTEGER,
    "difficulty" DECIMAL(6,2),
    "cpc" DECIMAL(12,4),
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_lists" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_list_items" (
    "list_id" UUID NOT NULL,
    "keyword_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_list_items_pkey" PRIMARY KEY ("list_id","keyword_id")
);

-- CreateTable
CREATE TABLE "keyword_clusters" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_cluster_items" (
    "cluster_id" UUID NOT NULL,
    "keyword_id" UUID NOT NULL,
    "score" DECIMAL(8,4),

    CONSTRAINT "keyword_cluster_items_pkey" PRIMARY KEY ("cluster_id","keyword_id")
);

-- CreateTable
CREATE TABLE "serp_snapshots" (
    "id" UUID NOT NULL,
    "keyword_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serp_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serp_results" (
    "id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "domain" CITEXT NOT NULL,
    "title" TEXT,
    "result_type" TEXT NOT NULL,

    CONSTRAINT "serp_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_platforms" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB,

    CONSTRAINT "geo_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_prompts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "geo_prompt_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "geo_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_prompt_schedules" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "cadence" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "next_run_at" TIMESTAMPTZ(6) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "geo_prompt_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_runs" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'QUEUED',
    "trigger" "run_trigger" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "credit_cost" DECIMAL(18,4),

    CONSTRAINT "geo_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_platform_results" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "platform_id" UUID NOT NULL,
    "response_ref" TEXT,
    "response_hash" TEXT,
    "status" "result_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_platform_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_mentions" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "mention_type" TEXT NOT NULL,
    "position_hint" INTEGER,
    "sentiment" TEXT,

    CONSTRAINT "geo_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_sources" (
    "id" UUID NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "domain" CITEXT NOT NULL,
    "title" TEXT,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_citations" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "rank" INTEGER,
    "citation_text_hash" TEXT,

    CONSTRAINT "geo_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_competitors" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" CITEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_competitor_mentions" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "competitor_id" UUID NOT NULL,
    "position_hint" INTEGER,

    CONSTRAINT "geo_competitor_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_visibility_snapshots" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "platform_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "metric_value" DECIMAL(18,4) NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_visibility_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_opportunities" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "run_id" UUID,
    "type" TEXT NOT NULL,
    "priority" SMALLINT NOT NULL,
    "status" "task_status" NOT NULL DEFAULT 'OPEN',
    "details_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "geo_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "schedule_id" UUID,
    "type" "report_type" NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'QUEUED',
    "title" TEXT NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_sections" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "section_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "report_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_files" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "format" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "report_type" "report_type" NOT NULL,
    "cadence" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "next_run_at" TIMESTAMPTZ(6) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_shares" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_wallets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "balance_cache" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "delta" DECIMAL(18,4) NOT NULL,
    "reason" "credit_reason" NOT NULL,
    "reference_type" TEXT,
    "reference_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_purchases" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider_payment_id" TEXT NOT NULL,
    "credits" DECIMAL(18,4) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_adjustments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" "adjustment_type" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "reason_code" TEXT NOT NULL,
    "internal_note" TEXT NOT NULL,
    "status" "adjustment_status" NOT NULL DEFAULT 'PENDING_REVIEW',
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "ledger_entry_id" UUID,
    "reverses_adjustment_id" UUID,
    "balance_before" DECIMAL(18,4),
    "balance_after" DECIMAL(18,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credit_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID,
    "feature_key" TEXT NOT NULL,
    "units" DECIMAL(18,4) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_usage" (
    "id" UUID NOT NULL,
    "usage_event_id" UUID,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "input_units" DECIMAL(18,4),
    "output_units" DECIMAL(18,4),
    "cost_minor" BIGINT,
    "currency" CHAR(3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "plan_status" NOT NULL DEFAULT 'DRAFT',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_prices" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_interval" "billing_interval" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "provider_price_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module_key" TEXT,
    "description" TEXT,
    "value_type" "entitlement_value_type" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_entitlements" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "limit_numeric" DECIMAL(18,4),
    "config_json" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_entitlement_overrides" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "limit_numeric" DECIMAL(18,4),
    "config_json" JSONB,
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_entitlement_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_customers" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "provider_subscription_id" TEXT,
    "status" "subscription_status" NOT NULL,
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_items" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "plan_price_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "subscription_id" UUID,
    "workspace_id" UUID NOT NULL,
    "provider_invoice_id" TEXT NOT NULL,
    "status" "invoice_status" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "total_minor" BIGINT NOT NULL,
    "issued_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "quantity" DECIMAL(18,4),

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_ref" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_providers" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "auth_type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scopes_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_integrations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "status" "connection_status" NOT NULL DEFAULT 'PENDING',
    "external_account_ref" TEXT,
    "connected_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_tokens" (
    "id" UUID NOT NULL,
    "workspace_integration_id" UUID NOT NULL,
    "access_secret_ref" TEXT NOT NULL,
    "refresh_secret_ref" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "workspace_integration_id" UUID NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "error_code" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "delivery_status" NOT NULL DEFAULT 'QUEUED',
    "provider_message_id" TEXT,
    "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_authors" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "display_name" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "bio" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cms_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_categories" (
    "id" UUID NOT NULL,
    "content_type" "cms_content_type" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL,
    "author_id" UUID,
    "category_id" UUID,
    "featured_media_id" UUID,
    "title" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "publish_status" NOT NULL DEFAULT 'DRAFT',
    "excerpt" TEXT,
    "body_ref" TEXT NOT NULL,
    "seo_title" TEXT,
    "meta_description" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_tags" (
    "post_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "blog_post_tags_pkey" PRIMARY KEY ("post_id","tag_id")
);

-- CreateTable
CREATE TABLE "guides" (
    "id" UUID NOT NULL,
    "category_id" UUID,
    "title" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "publish_status" NOT NULL DEFAULT 'DRAFT',
    "excerpt" TEXT,
    "body_ref" TEXT NOT NULL,
    "seo_title" TEXT,
    "meta_description" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_articles" (
    "id" UUID NOT NULL,
    "category_id" UUID,
    "title" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "publish_status" NOT NULL DEFAULT 'DRAFT',
    "excerpt" TEXT,
    "body_ref" TEXT NOT NULL,
    "seo_title" TEXT,
    "meta_description" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "alt_text" TEXT,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_openings" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'DRAFT',
    "department" TEXT,
    "location_text" TEXT,
    "employment_type" TEXT NOT NULL,
    "work_arrangement" "work_arrangement",
    "compensation_text" TEXT,
    "summary" TEXT,
    "description_ref" TEXT NOT NULL,
    "show_on_careers_page" BOOLEAN NOT NULL DEFAULT true,
    "application_deadline" TIMESTAMPTZ(6),
    "require_resume" BOOLEAN NOT NULL DEFAULT true,
    "require_cover_letter" BOOLEAN NOT NULL DEFAULT false,
    "seo_title" TEXT,
    "meta_description" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" TEXT,
    "linkedin_url" TEXT,
    "portfolio_url" TEXT,
    "message" TEXT,
    "status" "application_status" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant_files" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "malware_scan_status" "scan_status" NOT NULL DEFAULT 'PENDING',
    "checksum" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicant_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring_notes" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hiring_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_controls" (
    "module_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "module_controls_pkey" PRIMARY KEY ("module_key")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_rules" (
    "id" UUID NOT NULL,
    "flag_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_value" TEXT NOT NULL,
    "percentage" DECIMAL(5,2),
    "priority" INTEGER NOT NULL,

    CONSTRAINT "feature_flag_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "security_settings" (
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "security_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_activity" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_role" TEXT,
    "organization_id" UUID,
    "workspace_id" UUID,
    "event_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "reason" TEXT,
    "ip_address" INET,
    "device_metadata" JSONB,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL,
    "ip_hash" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_ref" TEXT NOT NULL,
    "status" "webhook_status" NOT NULL DEFAULT 'RECEIVED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" UUID NOT NULL,
    "queue" TEXT NOT NULL,
    "job_key" TEXT,
    "status" "job_run_status" NOT NULL DEFAULT 'QUEUED',
    "payload_ref" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request_id" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_incidents" (
    "id" UUID NOT NULL,
    "status" "incident_status" NOT NULL DEFAULT 'INVESTIGATING',
    "title" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "public_summary" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_check_results" (
    "id" UUID NOT NULL,
    "component_key" TEXT NOT NULL,
    "status" "health_status" NOT NULL,
    "latency_ms" INTEGER,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_subject_key" ON "users"("auth_subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_provider_account_id_key" ON "auth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "mfa_factors_user_id_idx" ON "mfa_factors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");

-- CreateIndex
CREATE INDEX "passkeys_user_id_idx" ON "passkeys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organization_memberships_user_id_status_idx" ON "organization_memberships"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_organization_id_user_id_key" ON "organization_memberships"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "workspaces_status_idx" ON "workspaces"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_organization_id_slug_key" ON "workspaces"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_id_organization_id_key" ON "workspaces"("id", "organization_id");

-- CreateIndex
CREATE INDEX "workspace_memberships_user_id_status_idx" ON "workspace_memberships"("user_id", "status");

-- CreateIndex
CREATE INDEX "workspace_memberships_status_idx" ON "workspace_memberships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_workspace_id_user_id_key" ON "workspace_memberships"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE INDEX "roles_is_system_idx" ON "roles"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "role_assignments_user_id_revoked_at_idx" ON "role_assignments"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "role_assignments_role_id_idx" ON "role_assignments"("role_id");

-- CreateIndex
CREATE INDEX "role_assignments_organization_id_idx" ON "role_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "role_assignments_workspace_id_idx" ON "role_assignments"("workspace_id");

-- CreateIndex
CREATE INDEX "role_assignments_project_id_idx" ON "role_assignments"("project_id");

-- CreateIndex
CREATE INDEX "projects_workspace_id_status_created_at_idx" ON "projects"("workspace_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspace_id_slug_key" ON "projects"("workspace_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "domains_project_id_host_key" ON "domains"("project_id", "host");

-- CreateIndex
CREATE INDEX "pages_domain_id_last_seen_at_idx" ON "pages"("domain_id", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "pages_domain_id_url_key" ON "pages"("domain_id", "url");

-- CreateIndex
CREATE INDEX "project_data_sources_project_id_status_idx" ON "project_data_sources"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_data_sources_project_id_workspace_integration_id_so_key" ON "project_data_sources"("project_id", "workspace_integration_id", "source_type");

-- CreateIndex
CREATE INDEX "audit_runs_project_id_status_started_at_idx" ON "audit_runs"("project_id", "status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "audit_runs_project_id_started_at_idx" ON "audit_runs"("project_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "audit_pages_page_id_idx" ON "audit_pages"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_pages_audit_run_id_page_id_key" ON "audit_pages"("audit_run_id", "page_id");

-- CreateIndex
CREATE INDEX "audit_findings_audit_page_id_severity_status_rule_key_idx" ON "audit_findings"("audit_page_id", "severity", "status", "rule_key");

-- CreateIndex
CREATE INDEX "audit_findings_fingerprint_idx" ON "audit_findings"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "audit_findings_audit_page_id_fingerprint_key" ON "audit_findings"("audit_page_id", "fingerprint");

-- CreateIndex
CREATE INDEX "audit_recommendations_finding_id_priority_idx" ON "audit_recommendations"("finding_id", "priority");

-- CreateIndex
CREATE INDEX "finding_events_finding_id_created_at_idx" ON "finding_events"("finding_id", "created_at");

-- CreateIndex
CREATE INDEX "optimization_tasks_project_id_status_assigned_to_idx" ON "optimization_tasks"("project_id", "status", "assigned_to");

-- CreateIndex
CREATE INDEX "optimization_tasks_assigned_to_idx" ON "optimization_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "verification_runs_task_id_created_at_idx" ON "verification_runs"("task_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "editor_documents_project_id_page_id_status_idx" ON "editor_documents"("project_id", "page_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "editor_versions_document_id_version_no_key" ON "editor_versions"("document_id", "version_no" DESC);

-- CreateIndex
CREATE INDEX "editor_suggestions_version_id_status_type_idx" ON "editor_suggestions"("version_id", "status", "type");

-- CreateIndex
CREATE INDEX "editor_change_events_document_id_created_at_idx" ON "editor_change_events"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "content_ideas_project_id_status_idx" ON "content_ideas"("project_id", "status");

-- CreateIndex
CREATE INDEX "content_briefs_project_id_status_idx" ON "content_briefs"("project_id", "status");

-- CreateIndex
CREATE INDEX "content_plans_project_id_status_idx" ON "content_plans"("project_id", "status");

-- CreateIndex
CREATE INDEX "content_plan_items_plan_id_status_target_date_idx" ON "content_plan_items"("plan_id", "status", "target_date");

-- CreateIndex
CREATE INDEX "keyword_queries_project_id_created_at_idx" ON "keyword_queries"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "keywords_normalized_term_idx" ON "keywords"("normalized_term");

-- CreateIndex
CREATE UNIQUE INDEX "keywords_normalized_term_locale_country_code_key" ON "keywords"("normalized_term", "locale", "country_code");

-- CreateIndex
CREATE INDEX "keyword_metric_snapshots_keyword_id_captured_at_idx" ON "keyword_metric_snapshots"("keyword_id", "captured_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "keyword_lists_project_id_name_key" ON "keyword_lists"("project_id", "name");

-- CreateIndex
CREATE INDEX "keyword_list_items_keyword_id_idx" ON "keyword_list_items"("keyword_id");

-- CreateIndex
CREATE INDEX "keyword_clusters_project_id_idx" ON "keyword_clusters"("project_id");

-- CreateIndex
CREATE INDEX "keyword_cluster_items_keyword_id_idx" ON "keyword_cluster_items"("keyword_id");

-- CreateIndex
CREATE INDEX "serp_snapshots_keyword_id_captured_at_idx" ON "serp_snapshots"("keyword_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "serp_results_snapshot_id_position_idx" ON "serp_results"("snapshot_id", "position");

-- CreateIndex
CREATE INDEX "serp_results_domain_idx" ON "serp_results"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "serp_results_snapshot_id_position_result_type_url_key" ON "serp_results"("snapshot_id", "position", "result_type", "url");

-- CreateIndex
CREATE UNIQUE INDEX "geo_platforms_key_key" ON "geo_platforms"("key");

-- CreateIndex
CREATE INDEX "geo_platforms_is_active_idx" ON "geo_platforms"("is_active");

-- CreateIndex
CREATE INDEX "geo_prompts_project_id_status_idx" ON "geo_prompts"("project_id", "status");

-- CreateIndex
CREATE INDEX "geo_prompt_schedules_prompt_id_idx" ON "geo_prompt_schedules"("prompt_id");

-- CreateIndex
CREATE INDEX "geo_runs_prompt_id_started_at_status_idx" ON "geo_runs"("prompt_id", "started_at" DESC, "status");

-- CreateIndex
CREATE INDEX "geo_platform_results_run_id_platform_id_status_idx" ON "geo_platform_results"("run_id", "platform_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "geo_platform_results_run_id_platform_id_key" ON "geo_platform_results"("run_id", "platform_id");

-- CreateIndex
CREATE INDEX "geo_mentions_result_id_entity_idx" ON "geo_mentions"("result_id", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "geo_sources_canonical_url_key" ON "geo_sources"("canonical_url");

-- CreateIndex
CREATE INDEX "geo_sources_domain_idx" ON "geo_sources"("domain");

-- CreateIndex
CREATE INDEX "geo_citations_result_id_idx" ON "geo_citations"("result_id");

-- CreateIndex
CREATE INDEX "geo_citations_source_id_idx" ON "geo_citations"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "geo_citations_result_id_source_id_rank_key" ON "geo_citations"("result_id", "source_id", "rank");

-- CreateIndex
CREATE INDEX "geo_competitors_project_id_status_idx" ON "geo_competitors"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "geo_competitors_project_id_name_key" ON "geo_competitors"("project_id", "name");

-- CreateIndex
CREATE INDEX "geo_competitor_mentions_competitor_id_idx" ON "geo_competitor_mentions"("competitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "geo_competitor_mentions_result_id_competitor_id_key" ON "geo_competitor_mentions"("result_id", "competitor_id");

-- CreateIndex
CREATE INDEX "geo_visibility_snapshots_project_id_platform_id_captured_at_idx" ON "geo_visibility_snapshots"("project_id", "platform_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "geo_opportunities_project_id_status_priority_idx" ON "geo_opportunities"("project_id", "status", "priority");

-- CreateIndex
CREATE INDEX "reports_project_id_status_created_at_idx" ON "reports"("project_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "report_sections_report_id_position_idx" ON "report_sections"("report_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "report_sections_report_id_section_key_key" ON "report_sections"("report_id", "section_key");

-- CreateIndex
CREATE UNIQUE INDEX "report_files_storage_key_key" ON "report_files"("storage_key");

-- CreateIndex
CREATE INDEX "report_files_report_id_idx" ON "report_files"("report_id");

-- CreateIndex
CREATE INDEX "report_schedules_project_id_idx" ON "report_schedules"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_shares_token_hash_key" ON "report_shares"("token_hash");

-- CreateIndex
CREATE INDEX "report_shares_report_id_expires_at_idx" ON "report_shares"("report_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_wallets_workspace_id_key" ON "credit_wallets"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_idempotency_key_key" ON "credit_ledger"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_ledger_wallet_id_created_at_idx" ON "credit_ledger"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "credit_ledger_reference_type_reference_id_idx" ON "credit_ledger"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_purchases_provider_payment_id_key" ON "credit_purchases"("provider_payment_id");

-- CreateIndex
CREATE INDEX "credit_purchases_workspace_id_status_idx" ON "credit_purchases"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "credit_adjustments_ledger_entry_id_key" ON "credit_adjustments"("ledger_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_adjustments_reverses_adjustment_id_key" ON "credit_adjustments"("reverses_adjustment_id");

-- CreateIndex
CREATE INDEX "credit_adjustments_workspace_id_status_created_at_idx" ON "credit_adjustments"("workspace_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "credit_adjustments_status_idx" ON "credit_adjustments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "usage_events_idempotency_key_key" ON "usage_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "usage_events_workspace_id_feature_key_occurred_at_idx" ON "usage_events"("workspace_id", "feature_key", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "provider_usage_provider_operation_created_at_idx" ON "provider_usage"("provider", "operation", "created_at" DESC);

-- CreateIndex
CREATE INDEX "provider_usage_usage_event_id_idx" ON "provider_usage"("usage_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "plans_status_display_order_idx" ON "plans"("status", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "plan_prices_provider_price_id_key" ON "plan_prices"("provider_price_id");

-- CreateIndex
CREATE INDEX "plan_prices_plan_id_active_idx" ON "plan_prices"("plan_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "features_key_key" ON "features"("key");

-- CreateIndex
CREATE INDEX "features_module_key_idx" ON "features"("module_key");

-- CreateIndex
CREATE INDEX "plan_entitlements_feature_id_idx" ON "plan_entitlements"("feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_entitlements_plan_id_feature_id_key" ON "plan_entitlements"("plan_id", "feature_id");

-- CreateIndex
CREATE INDEX "workspace_entitlement_overrides_workspace_id_feature_id_sta_idx" ON "workspace_entitlement_overrides"("workspace_id", "feature_id", "starts_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_provider_provider_customer_id_key" ON "billing_customers"("provider", "provider_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_workspace_id_provider_key" ON "billing_customers"("workspace_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_workspace_id_status_idx" ON "subscriptions"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_items_subscription_id_plan_price_id_key" ON "subscription_items"("subscription_id", "plan_price_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_provider_invoice_id_key" ON "invoices"("provider_invoice_id");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_status_issued_at_idx" ON "invoices"("workspace_id", "status", "issued_at" DESC);

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_events_received_at_event_type_idx" ON "payment_events"("received_at", "event_type");

-- CreateIndex
CREATE INDEX "payment_events_workspace_id_idx" ON "payment_events"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_provider_event_id_key" ON "payment_events"("provider", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_providers_key_key" ON "integration_providers"("key");

-- CreateIndex
CREATE INDEX "integration_providers_active_idx" ON "integration_providers"("active");

-- CreateIndex
CREATE INDEX "workspace_integrations_workspace_id_provider_id_status_idx" ON "workspace_integrations"("workspace_id", "provider_id", "status");

-- CreateIndex
CREATE INDEX "integration_tokens_workspace_integration_id_idx" ON "integration_tokens"("workspace_integration_id");

-- CreateIndex
CREATE INDEX "sync_runs_workspace_integration_id_started_at_idx" ON "sync_runs"("workspace_integration_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_workspace_id_idx" ON "notification_preferences"("user_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_workspace_id_user_id_event_key_cha_key" ON "notification_preferences"("workspace_id", "user_id", "event_key", "channel");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_workspace_id_idx" ON "notifications"("workspace_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_attempted_at_idx" ON "notification_deliveries"("notification_id", "attempted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_authors_user_id_key" ON "cms_authors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_authors_slug_key" ON "cms_authors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_categories_content_type_slug_key" ON "cms_categories"("content_type", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_tags_slug_key" ON "cms_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts"("author_id");

-- CreateIndex
CREATE INDEX "blog_post_tags_tag_id_idx" ON "blog_post_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "guides_slug_key" ON "guides"("slug");

-- CreateIndex
CREATE INDEX "guides_status_published_at_idx" ON "guides"("status", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "help_articles_slug_key" ON "help_articles"("slug");

-- CreateIndex
CREATE INDEX "help_articles_status_published_at_idx" ON "help_articles"("status", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_mime_type_uploaded_by_idx" ON "media_assets"("mime_type", "uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "job_openings_slug_key" ON "job_openings"("slug");

-- CreateIndex
CREATE INDEX "job_openings_status_published_at_idx" ON "job_openings"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "job_applications_job_id_status_submitted_at_idx" ON "job_applications"("job_id", "status", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "job_applications_email_idx" ON "job_applications"("email");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_files_storage_key_key" ON "applicant_files"("storage_key");

-- CreateIndex
CREATE INDEX "applicant_files_application_id_idx" ON "applicant_files"("application_id");

-- CreateIndex
CREATE INDEX "application_events_application_id_created_at_idx" ON "application_events"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "hiring_notes_application_id_created_at_idx" ON "hiring_notes"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "module_controls_enabled_idx" ON "module_controls"("enabled");

-- CreateIndex
CREATE INDEX "feature_flags_enabled_environment_idx" ON "feature_flags"("enabled", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_environment_key" ON "feature_flags"("key", "environment");

-- CreateIndex
CREATE INDEX "feature_flag_rules_flag_id_priority_idx" ON "feature_flag_rules"("flag_id", "priority");

-- CreateIndex
CREATE INDEX "admin_activity_actor_user_id_created_at_idx" ON "admin_activity"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_activity_target_type_target_id_idx" ON "admin_activity"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "admin_activity_created_at_idx" ON "admin_activity"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "security_events_risk_level_idx" ON "security_events"("risk_level");

-- CreateIndex
CREATE INDEX "webhook_events_status_received_at_idx" ON "webhook_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_provider_event_id_key" ON "webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "background_jobs_job_key_key" ON "background_jobs"("job_key");

-- CreateIndex
CREATE INDEX "background_jobs_queue_status_run_at_idx" ON "background_jobs"("queue", "status", "run_at");

-- CreateIndex
CREATE INDEX "provider_events_provider_operation_created_at_idx" ON "provider_events"("provider", "operation", "created_at" DESC);

-- CreateIndex
CREATE INDEX "system_incidents_status_started_at_idx" ON "system_incidents"("status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "health_check_results_component_key_checked_at_idx" ON "health_check_results"("component_key", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "workspaces"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_data_sources" ADD CONSTRAINT "project_data_sources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_data_sources" ADD CONSTRAINT "project_data_sources_workspace_integration_id_fkey" FOREIGN KEY ("workspace_integration_id") REFERENCES "workspace_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_pages" ADD CONSTRAINT "audit_pages_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_pages" ADD CONSTRAINT "audit_pages_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_audit_page_id_fkey" FOREIGN KEY ("audit_page_id") REFERENCES "audit_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_recommendations" ADD CONSTRAINT "audit_recommendations_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "audit_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_events" ADD CONSTRAINT "finding_events_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "audit_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_tasks" ADD CONSTRAINT "optimization_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_tasks" ADD CONSTRAINT "optimization_tasks_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "audit_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_tasks" ADD CONSTRAINT "optimization_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "optimization_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_documents" ADD CONSTRAINT "editor_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_documents" ADD CONSTRAINT "editor_documents_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_documents" ADD CONSTRAINT "editor_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_versions" ADD CONSTRAINT "editor_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "editor_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_versions" ADD CONSTRAINT "editor_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_suggestions" ADD CONSTRAINT "editor_suggestions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "editor_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_change_events" ADD CONSTRAINT "editor_change_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "editor_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_change_events" ADD CONSTRAINT "editor_change_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_primary_keyword_id_fkey" FOREIGN KEY ("primary_keyword_id") REFERENCES "keywords"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_plans" ADD CONSTRAINT "content_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_plan_items" ADD CONSTRAINT "content_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "content_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_plan_items" ADD CONSTRAINT "content_plan_items_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "content_briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_queries" ADD CONSTRAINT "keyword_queries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_queries" ADD CONSTRAINT "keyword_queries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_metric_snapshots" ADD CONSTRAINT "keyword_metric_snapshots_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_lists" ADD CONSTRAINT "keyword_lists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_lists" ADD CONSTRAINT "keyword_lists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_list_items" ADD CONSTRAINT "keyword_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "keyword_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_list_items" ADD CONSTRAINT "keyword_list_items_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_clusters" ADD CONSTRAINT "keyword_clusters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_cluster_items" ADD CONSTRAINT "keyword_cluster_items_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "keyword_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_cluster_items" ADD CONSTRAINT "keyword_cluster_items_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serp_snapshots" ADD CONSTRAINT "serp_snapshots_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "serp_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_prompts" ADD CONSTRAINT "geo_prompts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_prompts" ADD CONSTRAINT "geo_prompts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_prompt_schedules" ADD CONSTRAINT "geo_prompt_schedules_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "geo_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_runs" ADD CONSTRAINT "geo_runs_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "geo_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_platform_results" ADD CONSTRAINT "geo_platform_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "geo_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_platform_results" ADD CONSTRAINT "geo_platform_results_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "geo_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_mentions" ADD CONSTRAINT "geo_mentions_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "geo_platform_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_citations" ADD CONSTRAINT "geo_citations_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "geo_platform_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_citations" ADD CONSTRAINT "geo_citations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "geo_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_competitors" ADD CONSTRAINT "geo_competitors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_competitor_mentions" ADD CONSTRAINT "geo_competitor_mentions_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "geo_platform_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_competitor_mentions" ADD CONSTRAINT "geo_competitor_mentions_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "geo_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_visibility_snapshots" ADD CONSTRAINT "geo_visibility_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_visibility_snapshots" ADD CONSTRAINT "geo_visibility_snapshots_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "geo_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_opportunities" ADD CONSTRAINT "geo_opportunities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_opportunities" ADD CONSTRAINT "geo_opportunities_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "geo_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "report_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_sections" ADD CONSTRAINT "report_sections_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_files" ADD CONSTRAINT "report_files_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "credit_adjustments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "credit_adjustments_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "credit_adjustments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_adjustments" ADD CONSTRAINT "credit_adjustments_reverses_adjustment_id_fkey" FOREIGN KEY ("reverses_adjustment_id") REFERENCES "credit_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_usage_event_id_fkey" FOREIGN KEY ("usage_event_id") REFERENCES "usage_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_entitlement_overrides" ADD CONSTRAINT "workspace_entitlement_overrides_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_entitlement_overrides" ADD CONSTRAINT "workspace_entitlement_overrides_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_entitlement_overrides" ADD CONSTRAINT "workspace_entitlement_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_plan_price_id_fkey" FOREIGN KEY ("plan_price_id") REFERENCES "plan_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "integration_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_connected_by_fkey" FOREIGN KEY ("connected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_tokens" ADD CONSTRAINT "integration_tokens_workspace_integration_id_fkey" FOREIGN KEY ("workspace_integration_id") REFERENCES "workspace_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_workspace_integration_id_fkey" FOREIGN KEY ("workspace_integration_id") REFERENCES "workspace_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_authors" ADD CONSTRAINT "cms_authors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "cms_authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cms_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_media_id_fkey" FOREIGN KEY ("featured_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "cms_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cms_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cms_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_files" ADD CONSTRAINT "applicant_files_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_notes" ADD CONSTRAINT "hiring_notes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_notes" ADD CONSTRAINT "hiring_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_controls" ADD CONSTRAINT "module_controls_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "feature_flag_rules_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_settings" ADD CONSTRAINT "security_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_activity" ADD CONSTRAINT "admin_activity_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
