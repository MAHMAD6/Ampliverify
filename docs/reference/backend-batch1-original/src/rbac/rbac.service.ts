import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, Repository } from 'typeorm';
import {
  MembershipStatus,
  OrganizationMembership,
  Permission,
  Project,
  Role,
  RoleAssignment,
  RolePermission,
  ScopeType,
  Workspace,
  WorkspaceMembership,
  User,
} from '../db/entities';
import { AuditService } from '../audit/audit.service';
import { CreateRoleAssignmentDto } from './dto/create-role-assignment.dto';
import { CreateRoleDto } from './dto/create-role.dto';

export type ResourceScope = {
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
};

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(RoleAssignment)
    private readonly assignments: Repository<RoleAssignment>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissions: Repository<RolePermission>,
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(OrganizationMembership)
    private readonly orgMemberships: Repository<OrganizationMembership>,
    @InjectRepository(WorkspaceMembership)
    private readonly workspaceMemberships: Repository<WorkspaceMembership>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async hasPermission(userId: string, permissionKey: string, scope: ResourceScope = {}) {
    const qb = this.assignments
      .createQueryBuilder('assignment')
      .innerJoin('assignment.role', 'role')
      .innerJoin('role.rolePermissions', 'rolePermission')
      .innerJoin('rolePermission.permission', 'permission')
      .where('assignment.user_id = :userId', { userId })
      .andWhere('assignment.revoked_at IS NULL')
      .andWhere('permission.key = :permissionKey', { permissionKey })
      .andWhere(
        new Brackets((scopes) => {
          scopes.where(`assignment.scope_type = 'GLOBAL'`);
          if (scope.organizationId) {
            scopes.orWhere(
              `assignment.scope_type = 'ORGANIZATION' AND assignment.organization_id = :organizationId`,
              { organizationId: scope.organizationId },
            );
          }
          if (scope.workspaceId) {
            scopes.orWhere(
              `assignment.scope_type = 'WORKSPACE' AND assignment.workspace_id = :workspaceId`,
              { workspaceId: scope.workspaceId },
            );
          }
          if (scope.projectId) {
            scopes.orWhere(
              `assignment.scope_type = 'PROJECT' AND assignment.project_id = :projectId`,
              { projectId: scope.projectId },
            );
          }
        }),
      );

    return (await qb.getCount()) > 0;
  }

  async assertPermission(userId: string, permissionKey: string, scope: ResourceScope = {}) {
    if (!(await this.hasPermission(userId, permissionKey, scope))) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to perform this action.',
      });
    }
  }

  assertGlobalPermission(userId: string, permissionKey: string) {
    return this.assertPermission(userId, permissionKey, {});
  }

  async listRoles() {
    return this.roles.find({ order: { isSystem: 'DESC', name: 'ASC' } });
  }

  async createRole(actorId: string, dto: CreateRoleDto, requestMeta?: { ipAddress?: string; userAgent?: string }) {
    await this.assertGlobalPermission(actorId, 'admin.role.manage');

    const normalizedKey = dto.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!normalizedKey) {
      throw new BadRequestException({ code: 'INVALID_ROLE_KEY', message: 'Role key is invalid.' });
    }

    const existing = await this.roles.findOne({ where: { key: normalizedKey } });
    if (existing) {
      throw new ConflictException({ code: 'ROLE_KEY_EXISTS', message: 'A role with this key already exists.' });
    }

    const uniquePermissionKeys = [...new Set(dto.permissionKeys)];
    const permissions = await this.permissions
      .createQueryBuilder('permission')
      .where('permission.key IN (:...keys)', { keys: uniquePermissionKeys })
      .getMany();

    if (permissions.length !== uniquePermissionKeys.length) {
      const found = new Set(permissions.map((permission) => permission.key));
      const missing = uniquePermissionKeys.filter((key) => !found.has(key));
      throw new BadRequestException({
        code: 'UNKNOWN_PERMISSIONS',
        message: `Unknown permissions: ${missing.join(', ')}`,
      });
    }

    for (const permission of permissions) {
      await this.assertGlobalPermission(actorId, permission.key);
    }

    return this.dataSource.transaction(async (manager) => {
      const roleRepo = manager.getRepository(Role);
      const rolePermissionRepo = manager.getRepository(RolePermission);
      const role = await roleRepo.save(
        roleRepo.create({ key: normalizedKey, name: dto.name.trim(), isSystem: false }),
      );

      await rolePermissionRepo.save(
        permissions.map((permission) =>
          rolePermissionRepo.create({ roleId: role.id, permissionId: permission.id }),
        ),
      );

      await this.audit.recordWithManager(manager, {
        actorUserId: actorId,
        action: 'role.create',
        targetType: 'role',
        targetId: role.id,
        afterState: { key: role.key, name: role.name, permissions: uniquePermissionKeys },
        ipAddress: requestMeta?.ipAddress ?? null,
        deviceMetadata: requestMeta?.userAgent ? { userAgent: requestMeta.userAgent } : null,
      });

      return role;
    });
  }

  async createAssignment(
    actorId: string,
    dto: CreateRoleAssignmentDto,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const targetUser = await this.users.findOne({ where: { id: dto.userId } });
    if (!targetUser) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Target user not found.' });
    }

    if (actorId === dto.userId) {
      throw new ForbiddenException({
        code: 'SELF_ASSIGNMENT_NOT_ALLOWED',
        message: 'You cannot assign a role to yourself.',
      });
    }

    const scope = await this.validateAndResolveScope(dto);
    await this.assertPermission(actorId, 'admin.access.manage', scope);

    const role = await this.roles.findOne({
      where: { id: dto.roleId },
      relations: { rolePermissions: { permission: true } },
    });
    if (!role) {
      throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' });
    }

    for (const rolePermission of role.rolePermissions) {
      await this.assertPermission(actorId, rolePermission.permission.key, scope);
    }

    await this.assertTargetUserMembership(dto.userId, dto.scopeType, scope);

    const activeDuplicate = await this.assignments.findOne({
      where: {
        userId: dto.userId,
        roleId: dto.roleId,
        scopeType: dto.scopeType,
        organizationId: dto.organizationId ?? null,
        workspaceId: dto.workspaceId ?? null,
        projectId: dto.projectId ?? null,
        revokedAt: IsNull(),
      },
    });
    if (activeDuplicate) {
      throw new ConflictException({
        code: 'ROLE_ASSIGNMENT_EXISTS',
        message: 'This active role assignment already exists.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RoleAssignment);
      const assignment = await repo.save(
        repo.create({
          userId: dto.userId,
          roleId: dto.roleId,
          scopeType: dto.scopeType,
          organizationId: dto.organizationId ?? null,
          workspaceId: dto.workspaceId ?? null,
          projectId: dto.projectId ?? null,
          createdBy: actorId,
          revokedAt: IsNull(),
        }),
      );

      await this.audit.recordWithManager(manager, {
        actorUserId: actorId,
        organizationId: scope.organizationId ?? null,
        workspaceId: scope.workspaceId ?? null,
        action: 'access.assignment.create',
        targetType: 'role_assignment',
        targetId: assignment.id,
        afterState: {
          userId: dto.userId,
          roleId: dto.roleId,
          roleKey: role.key,
          scopeType: dto.scopeType,
          ...scope,
        },
        ipAddress: requestMeta?.ipAddress ?? null,
        deviceMetadata: requestMeta?.userAgent ? { userAgent: requestMeta.userAgent } : null,
      });

      return assignment;
    });
  }

  async revokeAssignment(
    actorId: string,
    assignmentId: string,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { role: { rolePermissions: { permission: true } } },
    });
    if (!assignment || assignment.revokedAt) {
      throw new NotFoundException({ code: 'ROLE_ASSIGNMENT_NOT_FOUND', message: 'Active role assignment not found.' });
    }
    if (assignment.userId === actorId) {
      throw new ForbiddenException({
        code: 'SELF_REVOCATION_NOT_ALLOWED',
        message: 'You cannot revoke your own role assignment.',
      });
    }

    const scope = await this.scopeFromAssignment(assignment);
    await this.assertPermission(actorId, 'admin.access.manage', scope);
    for (const rolePermission of assignment.role.rolePermissions) {
      await this.assertPermission(actorId, rolePermission.permission.key, scope);
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RoleAssignment);
      const beforeState = {
        revokedAt: assignment.revokedAt,
        roleId: assignment.roleId,
        userId: assignment.userId,
        scopeType: assignment.scopeType,
        ...scope,
      };
      assignment.revokedAt = new Date();
      const saved = await repo.save(assignment);

      await this.audit.recordWithManager(manager, {
        actorUserId: actorId,
        organizationId: scope.organizationId ?? null,
        workspaceId: scope.workspaceId ?? null,
        action: 'access.assignment.revoke',
        targetType: 'role_assignment',
        targetId: assignment.id,
        beforeState,
        afterState: { ...beforeState, revokedAt: saved.revokedAt?.toISOString() },
        ipAddress: requestMeta?.ipAddress ?? null,
        deviceMetadata: requestMeta?.userAgent ? { userAgent: requestMeta.userAgent } : null,
      });
      return saved;
    });
  }

  async listAssignments() {
    const assignments = await this.assignments.find({
      where: { revokedAt: IsNull() },
      relations: { role: true, user: true },
      order: { createdAt: 'DESC' },
    });
    return assignments.map((assignment) => ({
      id: assignment.id,
      user: {
        id: assignment.user.id,
        email: assignment.user.email,
        displayName: assignment.user.displayName,
        status: assignment.user.status,
      },
      role: { id: assignment.role.id, key: assignment.role.key, name: assignment.role.name },
      scopeType: assignment.scopeType,
      organizationId: assignment.organizationId,
      workspaceId: assignment.workspaceId,
      projectId: assignment.projectId,
      createdBy: assignment.createdBy,
      createdAt: assignment.createdAt,
    }));
  }

  async getProjectReadScopes(userId: string) {
    const rows = await this.assignments
      .createQueryBuilder('assignment')
      .innerJoin('assignment.role', 'role')
      .innerJoin('role.rolePermissions', 'rolePermission')
      .innerJoin('rolePermission.permission', 'permission')
      .select([
        'assignment.scope_type AS "scopeType"',
        'assignment.organization_id AS "organizationId"',
        'assignment.workspace_id AS "workspaceId"',
        'assignment.project_id AS "projectId"',
      ])
      .where('assignment.user_id = :userId', { userId })
      .andWhere('assignment.revoked_at IS NULL')
      .andWhere('permission.key = :permissionKey', { permissionKey: 'project.read' })
      .getRawMany<{ scopeType: ScopeType; organizationId: string | null; workspaceId: string | null; projectId: string | null }>();
    return rows;
  }

  private async validateAndResolveScope(dto: CreateRoleAssignmentDto): Promise<ResourceScope> {
    const supplied = [dto.organizationId, dto.workspaceId, dto.projectId].filter(Boolean).length;
    if (dto.scopeType === ScopeType.GLOBAL) {
      if (supplied !== 0) throw this.invalidScope();
      return {};
    }
    if (dto.scopeType === ScopeType.ORGANIZATION) {
      if (!dto.organizationId || supplied !== 1) throw this.invalidScope();
      return { organizationId: dto.organizationId };
    }
    if (dto.scopeType === ScopeType.WORKSPACE) {
      if (!dto.workspaceId || supplied !== 1) throw this.invalidScope();
      const workspace = await this.workspaces.findOne({ where: { id: dto.workspaceId } });
      if (!workspace) throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found.' });
      return { organizationId: workspace.organizationId, workspaceId: workspace.id };
    }
    if (dto.scopeType === ScopeType.PROJECT) {
      if (!dto.projectId || supplied !== 1) throw this.invalidScope();
      const project = await this.projects.findOne({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
      return {
        organizationId: project.organizationId,
        workspaceId: project.workspaceId,
        projectId: project.id,
      };
    }
    throw this.invalidScope();
  }

  private invalidScope() {
    return new BadRequestException({
      code: 'INVALID_SCOPE',
      message: 'Scope fields do not match the requested scope type.',
    });
  }

  private async assertTargetUserMembership(userId: string, scopeType: ScopeType, scope: ResourceScope) {
    if (scopeType === ScopeType.GLOBAL) return;

    if (scopeType === ScopeType.ORGANIZATION) {
      const membership = await this.orgMemberships.findOne({
        where: { userId, organizationId: scope.organizationId!, status: MembershipStatus.ACTIVE },
      });
      if (!membership) {
        throw new BadRequestException({
          code: 'TARGET_USER_NOT_IN_ORGANIZATION',
          message: 'The target user is not an active member of this organization.',
        });
      }
      return;
    }

    const membership = await this.workspaceMemberships.findOne({
      where: { userId, workspaceId: scope.workspaceId!, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new BadRequestException({
        code: 'TARGET_USER_NOT_IN_WORKSPACE',
        message: 'The target user is not an active member of this workspace.',
      });
    }
  }

  private async scopeFromAssignment(assignment: RoleAssignment): Promise<ResourceScope> {
    if (assignment.scopeType === ScopeType.GLOBAL) return {};
    if (assignment.scopeType === ScopeType.ORGANIZATION) {
      return { organizationId: assignment.organizationId! };
    }
    if (assignment.scopeType === ScopeType.WORKSPACE) {
      const workspace = await this.workspaces.findOne({ where: { id: assignment.workspaceId! } });
      if (!workspace) throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found.' });
      return { organizationId: workspace.organizationId, workspaceId: workspace.id };
    }
    const project = await this.projects.findOne({ where: { id: assignment.projectId! } });
    if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
    return { organizationId: project.organizationId, workspaceId: project.workspaceId, projectId: project.id };
  }
}
