import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  MembershipStatus,
  Organization,
  OrganizationMembership,
  Role,
  RoleAssignment,
  ScopeType,
  Workspace,
  WorkspaceMembership,
} from '../db/entities';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationMembership)
    private readonly orgMemberships: Repository<OrganizationMembership>,
    @InjectRepository(WorkspaceMembership)
    private readonly workspaceMemberships: Repository<WorkspaceMembership>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
  ) {}

  async listOrganizationsForUser(userId: string) {
    const memberships = await this.orgMemberships.find({
      where: { userId, status: MembershipStatus.ACTIVE },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map(({ organization }) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
    }));
  }

  async listWorkspacesForUser(userId: string, organizationId?: string) {
    const qb = this.workspaceMemberships
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.workspace', 'workspace')
      .where('membership.user_id = :userId', { userId })
      .andWhere('membership.status = :status', { status: MembershipStatus.ACTIVE });

    if (organizationId) {
      qb.andWhere('workspace.organization_id = :organizationId', { organizationId });
    }

    const memberships = await qb.orderBy('workspace.name', 'ASC').getMany();
    return memberships.map(({ workspace }) => ({
      id: workspace.id,
      organizationId: workspace.organizationId,
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
    }));
  }

  async createOrganization(
    actorId: string,
    dto: CreateOrganizationDto,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const ownerRole = await this.roles.findOne({ where: { key: 'OWNER' } });
    if (!ownerRole) {
      throw new NotFoundException({ code: 'OWNER_ROLE_MISSING', message: 'OWNER system role is not configured.' });
    }

    const name = dto.name.trim();
    const workspaceName = (dto.workspaceName ?? 'Default Workspace').trim();
    const slug = await this.uniqueOrganizationSlug(name);

    return this.dataSource.transaction(async (manager) => {
      const orgRepo = manager.getRepository(Organization);
      const workspaceRepo = manager.getRepository(Workspace);
      const orgMembershipRepo = manager.getRepository(OrganizationMembership);
      const workspaceMembershipRepo = manager.getRepository(WorkspaceMembership);
      const assignmentRepo = manager.getRepository(RoleAssignment);

      const organization = await orgRepo.save(orgRepo.create({ name, slug }));
      const workspace = await workspaceRepo.save(
        workspaceRepo.create({
          organizationId: organization.id,
          name: workspaceName,
          slug: this.slugify(workspaceName),
        }),
      );

      await orgMembershipRepo.save(
        orgMembershipRepo.create({
          userId: actorId,
          organizationId: organization.id,
          status: MembershipStatus.ACTIVE,
        }),
      );
      await workspaceMembershipRepo.save(
        workspaceMembershipRepo.create({
          userId: actorId,
          workspaceId: workspace.id,
          status: MembershipStatus.ACTIVE,
        }),
      );
      await assignmentRepo.save(
        assignmentRepo.create({
          userId: actorId,
          roleId: ownerRole.id,
          scopeType: ScopeType.ORGANIZATION,
          organizationId: organization.id,
          workspaceId: null,
          projectId: null,
          createdBy: actorId,
          revokedAt: null,
        }),
      );

      await this.audit.recordWithManager(manager, {
        actorUserId: actorId,
        organizationId: organization.id,
        workspaceId: workspace.id,
        action: 'organization.create',
        targetType: 'organization',
        targetId: organization.id,
        afterState: {
          organization: { id: organization.id, name: organization.name, slug: organization.slug },
          workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
        },
        ipAddress: requestMeta?.ipAddress ?? null,
        deviceMetadata: requestMeta?.userAgent ? { userAgent: requestMeta.userAgent } : null,
      });

      return { organization, workspace };
    });
  }

  async createWorkspace(
    actorId: string,
    dto: CreateWorkspaceDto,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const organization = await this.organizations.findOne({ where: { id: dto.organizationId } });
    if (!organization) {
      throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
    }
    await this.rbac.assertPermission(actorId, 'workspace.create', { organizationId: organization.id });

    const name = dto.name.trim();
    const slug = this.slugify(name);
    const duplicate = await this.workspaces.findOne({ where: { organizationId: organization.id, slug } });
    if (duplicate) {
      throw new ConflictException({
        code: 'WORKSPACE_SLUG_EXISTS',
        message: 'A workspace with this name already exists in the organization.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const workspaceRepo = manager.getRepository(Workspace);
      const membershipRepo = manager.getRepository(WorkspaceMembership);
      const workspace = await workspaceRepo.save(
        workspaceRepo.create({ organizationId: organization.id, name, slug }),
      );
      await membershipRepo.save(
        membershipRepo.create({ userId: actorId, workspaceId: workspace.id, status: MembershipStatus.ACTIVE }),
      );
      await this.audit.recordWithManager(manager, {
        actorUserId: actorId,
        organizationId: organization.id,
        workspaceId: workspace.id,
        action: 'workspace.create',
        targetType: 'workspace',
        targetId: workspace.id,
        afterState: { id: workspace.id, organizationId: organization.id, name, slug },
        ipAddress: requestMeta?.ipAddress ?? null,
        deviceMetadata: requestMeta?.userAgent ? { userAgent: requestMeta.userAgent } : null,
      });
      return workspace;
    });
  }

  private async uniqueOrganizationSlug(name: string) {
    const base = this.slugify(name);
    let slug = base;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const existing = await this.organizations.findOne({ where: { slug } });
      if (!existing) return slug;
      slug = `${base}-${attempt + 2}`.slice(0, 120);
    }
    throw new ConflictException({
      code: 'ORGANIZATION_SLUG_EXHAUSTED',
      message: 'Unable to generate a unique organization slug.',
    });
  }

  private slugify(input: string) {
    return (
      input
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'workspace'
    );
  }
}
