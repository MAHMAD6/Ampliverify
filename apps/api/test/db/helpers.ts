import { randomUUID } from 'crypto';
import { MembershipStatus, PrismaClient, ScopeType } from '@prisma/client';
import { AuditService } from '../../src/audit/audit.service';
import { RbacService } from '../../src/rbac/rbac.service';
import { OrganizationsService } from '../../src/organizations/organizations.service';
import { ProjectsService } from '../../src/projects/projects.service';
import { UsersService } from '../../src/users/users.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SettingsService } from '../../src/commerce/settings.service';
import { CreditsService } from '../../src/commerce/credits.service';
import { EntitlementsService } from '../../src/commerce/entitlements.service';

export function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL missing (global setup should have failed).');
  return url;
}

export function createPrisma() {
  return new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
}

export function createServices(prisma: PrismaClient) {
  const db = prisma as PrismaService;
  const audit = new AuditService(db);
  const rbac = new RbacService(db, audit);
  const settings = new SettingsService(db);
  const credits = new CreditsService(db, settings);
  const entitlements = new EntitlementsService(db, settings);
  return {
    audit,
    rbac,
    settings,
    credits,
    entitlements,
    users: new UsersService(db, audit),
    organizations: new OrganizationsService(db, audit, rbac, credits, settings),
    projects: new ProjectsService(db, rbac, audit, entitlements),
  };
}

export function uniq(label: string) {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

export function createUser(prisma: PrismaClient, label = 'user') {
  const tag = uniq(label);
  return prisma.user.create({ data: { authSubject: `auth|${tag}`, email: `${tag}@example.test` } });
}

export async function grantGlobal(prisma: PrismaClient, userId: string, roleKey: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  return prisma.roleAssignment.create({
    data: { userId, roleId: role.id, scopeType: ScopeType.GLOBAL, createdBy: userId },
  });
}

export async function addWorkspaceMember(prisma: PrismaClient, userId: string, workspaceId: string, organizationId: string) {
  await prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: { organizationId, userId, status: MembershipStatus.ACTIVE },
    update: { status: MembershipStatus.ACTIVE },
  });
  await prisma.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: { workspaceId, userId, status: MembershipStatus.ACTIVE },
    update: { status: MembershipStatus.ACTIVE },
  });
}

/** Rejects with an HttpException-like error carrying `response.code`. */
export async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ response: { code } });
}
