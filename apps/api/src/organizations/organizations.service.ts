import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, ScopeType } from '@prisma/client';
import { Db, PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { slugCandidate, slugify } from '../common/utils/slug';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

const SLUG_ATTEMPTS = 20;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
  ) {}

  async listOrganizationsForUser(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE, organization: { deletedAt: null } },
      include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map(({ organization }) => organization);
  }

  async listWorkspacesForUser(userId: string, organizationId?: string) {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        workspace: { deletedAt: null, ...(organizationId && { organizationId }) },
      },
      include: {
        workspace: { select: { id: true, organizationId: true, name: true, slug: true, status: true } },
      },
      orderBy: { workspace: { name: 'asc' } },
    });
    return memberships.map(({ workspace }) => workspace);
  }

  /**
   * Tenant onboarding. Atomically creates the organization, its default
   * workspace (with an empty credit wallet), the creator's memberships, an
   * organization-scoped OWNER assignment and the audit record.
   */
  async createOrganization(actorId: string, dto: CreateOrganizationDto, requestMeta?: RequestMeta) {
    const ownerRole = await this.prisma.role.findUnique({ where: { key: 'OWNER' } });
    if (!ownerRole) {
      throw new NotFoundException({ code: 'OWNER_ROLE_MISSING', message: 'OWNER system role is not configured.' });
    }

    const name = dto.name.trim();
    const workspaceName = (dto.workspaceName ?? 'Default Workspace').trim();
    const slug = await this.uniqueOrganizationSlug(name);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name, slug, createdBy: actorId },
      });
      const workspace = await this.createWorkspaceRecords(tx, actorId, organization.id, workspaceName);

      await tx.organizationMembership.create({
        data: { userId: actorId, organizationId: organization.id, status: MembershipStatus.ACTIVE },
      });
      await tx.roleAssignment.create({
        data: {
          userId: actorId,
          roleId: ownerRole.id,
          scopeType: ScopeType.ORGANIZATION,
          organizationId: organization.id,
          createdBy: actorId,
        },
      });

      await this.audit.record(
        {
          actorUserId: actorId,
          actorRole: 'OWNER',
          organizationId: organization.id,
          workspaceId: workspace.id,
          action: 'organization.create',
          targetType: 'organization',
          targetId: organization.id,
          afterState: {
            organization: { id: organization.id, name: organization.name, slug: organization.slug },
            workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
          },
          requestMeta,
        },
        tx,
      );

      return { organization, workspace };
    });
  }

  async createWorkspace(actorId: string, dto: CreateWorkspaceDto, requestMeta?: RequestMeta) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: dto.organizationId, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
    }
    await this.rbac.assertPermission(actorId, 'workspace.create', { organizationId: organization.id });

    const name = dto.name.trim();
    const slug = slugify(name, 'workspace');
    const duplicate = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId: organization.id, slug } },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'WORKSPACE_SLUG_EXISTS',
        message: 'A workspace with this name already exists in the organization.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const workspace = await this.createWorkspaceRecords(tx, actorId, organization.id, name, slug);
      await this.audit.record(
        {
          actorUserId: actorId,
          organizationId: organization.id,
          workspaceId: workspace.id,
          action: 'workspace.create',
          targetType: 'workspace',
          targetId: workspace.id,
          afterState: { id: workspace.id, organizationId: organization.id, name, slug },
          requestMeta,
        },
        tx,
      );
      return workspace;
    });
  }

  /** Workspace + creator membership + empty credit wallet (balance 0). */
  private async createWorkspaceRecords(
    tx: Db,
    actorId: string,
    organizationId: string,
    name: string,
    slug = slugify(name, 'workspace'),
  ) {
    const workspace = await tx.workspace.create({
      data: { organizationId, name, slug, createdBy: actorId },
    });
    await tx.workspaceMembership.create({
      data: { userId: actorId, workspaceId: workspace.id, status: MembershipStatus.ACTIVE },
    });
    await tx.creditWallet.create({ data: { workspaceId: workspace.id } });
    return workspace;
  }

  private async uniqueOrganizationSlug(name: string) {
    const base = slugify(name, 'organization');
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = slugCandidate(base, attempt);
      const existing = await this.prisma.organization.findUnique({ where: { slug } });
      if (!existing) return slug;
    }
    throw new ConflictException({
      code: 'ORGANIZATION_SLUG_EXHAUSTED',
      message: 'Unable to generate a unique organization slug.',
    });
  }
}

