import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialFoundation1727540000000 implements MigrationInterface {
  name = 'InitialFoundation1727540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);

    await queryRunner.query(`CREATE TYPE "users_status_enum" AS ENUM ('ACTIVE','SUSPENDED','DISABLED')`);
    await queryRunner.query(`CREATE TYPE "organizations_status_enum" AS ENUM ('ACTIVE','INACTIVE','ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE "workspaces_status_enum" AS ENUM ('ACTIVE','INACTIVE','ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE "organization_memberships_status_enum" AS ENUM ('ACTIVE','INVITED','SUSPENDED')`);
    await queryRunner.query(`CREATE TYPE "workspace_memberships_status_enum" AS ENUM ('ACTIVE','INVITED','SUSPENDED')`);
    await queryRunner.query(`CREATE TYPE "projects_status_enum" AS ENUM ('ACTIVE','ARCHIVED')`);
    await queryRunner.query(`CREATE TYPE "role_assignments_scope_type_enum" AS ENUM ('GLOBAL','ORGANIZATION','WORKSPACE','PROJECT')`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "auth_subject" varchar(191) NOT NULL UNIQUE,
        "email" citext NOT NULL UNIQUE,
        "display_name" varchar(160),
        "status" "users_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(160) NOT NULL,
        "slug" varchar(120) NOT NULL UNIQUE,
        "status" "organizations_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "name" varchar(160) NOT NULL,
        "slug" varchar(120) NOT NULL,
        "status" "workspaces_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_workspaces_org_slug" UNIQUE ("organization_id", "slug"),
        CONSTRAINT "uq_workspaces_id_org" UNIQUE ("id", "organization_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "status" "organization_memberships_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_org_membership_user_org" UNIQUE ("user_id", "organization_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "workspace_memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "status" "workspace_memberships_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_workspace_membership_user_workspace" UNIQUE ("user_id", "workspace_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
        "workspace_id" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "slug" varchar(120) NOT NULL,
        "status" "projects_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_projects_workspace_slug" UNIQUE ("workspace_id", "slug"),
        CONSTRAINT "fk_projects_workspace_org" FOREIGN KEY ("workspace_id", "organization_id")
          REFERENCES "workspaces"("id", "organization_id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar(120) NOT NULL UNIQUE,
        "name" varchar(160) NOT NULL,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar(160) NOT NULL UNIQUE,
        "description" varchar(255)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        PRIMARY KEY ("role_id", "permission_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
        "scope_type" "role_assignments_scope_type_enum" NOT NULL,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
        "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "revoked_at" timestamptz,
        CONSTRAINT "ck_role_assignments_scope" CHECK (
          (scope_type = 'GLOBAL' AND organization_id IS NULL AND workspace_id IS NULL AND project_id IS NULL) OR
          (scope_type = 'ORGANIZATION' AND organization_id IS NOT NULL AND workspace_id IS NULL AND project_id IS NULL) OR
          (scope_type = 'WORKSPACE' AND organization_id IS NULL AND workspace_id IS NOT NULL AND project_id IS NULL) OR
          (scope_type = 'PROJECT' AND organization_id IS NULL AND workspace_id IS NULL AND project_id IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_user_id" uuid,
        "actor_role" varchar(120),
        "organization_id" uuid,
        "workspace_id" uuid,
        "action" varchar(160) NOT NULL,
        "target_type" varchar(120) NOT NULL,
        "target_id" uuid,
        "before_state" jsonb,
        "after_state" jsonb,
        "reason" text,
        "ip_address" inet,
        "device_metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_workspaces_org" ON "workspaces"("organization_id")`);
    await queryRunner.query(`CREATE INDEX "idx_org_memberships_user" ON "organization_memberships"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_org_memberships_org" ON "organization_memberships"("organization_id")`);
    await queryRunner.query(`CREATE INDEX "idx_workspace_memberships_user" ON "workspace_memberships"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_workspace_memberships_workspace" ON "workspace_memberships"("workspace_id")`);
    await queryRunner.query(`CREATE INDEX "idx_projects_org" ON "projects"("organization_id")`);
    await queryRunner.query(`CREATE INDEX "idx_projects_workspace" ON "projects"("workspace_id")`);
    await queryRunner.query(`CREATE INDEX "idx_role_assignments_user" ON "role_assignments"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_role_assignments_role" ON "role_assignments"("role_id")`);
    await queryRunner.query(`CREATE INDEX "idx_role_assignments_scope_type" ON "role_assignments"("scope_type")`);
    await queryRunner.query(`CREATE INDEX "idx_role_assignments_revoked_at" ON "role_assignments"("revoked_at")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_active_role_assignment"
      ON "role_assignments"(
        "user_id", "role_id", "scope_type",
        COALESCE("organization_id", '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE("workspace_id", '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE("project_id", '00000000-0000-0000-0000-000000000000'::uuid)
      )
      WHERE "revoked_at" IS NULL
    `);
    await queryRunner.query(`CREATE INDEX "idx_audit_actor" ON "audit_events"("actor_user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_org" ON "audit_events"("organization_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_workspace" ON "audit_events"("workspace_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_action" ON "audit_events"("action")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_created" ON "audit_events"("created_at" DESC)`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_events are immutable';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_audit_events_immutable"
      BEFORE UPDATE OR DELETE ON "audit_events"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation()
    `);

    const permissions = [
      ['user.read', 'Read user records'],
      ['organization.read', 'Read organization records'],
      ['workspace.read', 'Read workspace records'],
      ['workspace.create', 'Create workspaces'],
      ['project.create', 'Create projects'],
      ['project.read', 'Read projects'],
      ['project.update', 'Update projects'],
      ['project.delete', 'Archive or delete projects'],
      ['admin.role.manage', 'Manage roles and role permissions'],
      ['admin.access.manage', 'Create and revoke access assignments'],
      ['audit.read', 'Read immutable audit events']
    ];

    for (const [key, description] of permissions) {
      await queryRunner.query(
        `INSERT INTO "permissions" ("key", "description") VALUES ($1, $2) ON CONFLICT ("key") DO NOTHING`,
        [key, description],
      );
    }

    const roles = [
      ['SUPER_ADMIN', 'Super Admin', true],
      ['ADMIN', 'Admin', true],
      ['SUB_ADMIN', 'Sub-Admin', true],
      ['OWNER', 'Owner', true],
      ['MEMBER', 'Member', true]
    ];

    for (const [key, name, isSystem] of roles) {
      await queryRunner.query(
        `INSERT INTO "roles" ("key", "name", "is_system") VALUES ($1, $2, $3) ON CONFLICT ("key") DO NOTHING`,
        [key, name, isSystem],
      );
    }

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "roles" r CROSS JOIN "permissions" p
      WHERE r.key = 'SUPER_ADMIN'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "roles" r
      JOIN "permissions" p ON p.key IN (
        'organization.read', 'workspace.read', 'workspace.create',
        'project.create', 'project.read', 'project.update', 'project.delete'
      )
      WHERE r.key = 'OWNER'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "roles" r
      JOIN "permissions" p ON p.key IN ('organization.read', 'workspace.read', 'project.read')
      WHERE r.key = 'MEMBER'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_audit_events_immutable" ON "audit_events"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_audit_event_mutation()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role_assignments_scope_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "projects_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "workspace_memberships_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_memberships_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "workspaces_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organizations_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_status_enum"`);
  }
}
