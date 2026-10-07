import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Prisma, RoleAssignment, ScopeType } from '@prisma/client';
import { Db, PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { CreateRoleAssignmentDto } from './dto/create-role-assignment.dto';
import { CreateRoleDto } from './dto/create-role.dto';

/**
 * The resource being acted on, resolved server-side. Narrower scopes always
 * carry their parents: a project scope includes its workspace and organization.
 */
export type ResourceScope = {
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
};

/** Scope a user may list projects in, for a given permission. */
export type ProjectAccessFilter = Prisma.ProjectWhereInput | null;

const ACTIVE = MembershipStatus.ACTIVE;

/**
 * Server-side RBAC. Outcome = role permissions + assignment scope + target
 * resource scope; the default is DENY.
 *
 * Scope inheritance: GLOBAL > ORGANIZATION > WORKSPACE > PROJECT. A tenant-scoped
 * assignment only counts while the user is still an ACTIVE member of that
 * organization (ORGANIZATION scope) or workspace (WORKSPACE/PROJECT scope), so
 * removing a member removes their access even before assignments are revoked.
 */
@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async hasPermission(userId: string, permissionKey: string, scope: ResourceScope = {}, db: Db = this.prisma) {
    const scopes: Prisma.RoleAssignmentWhereInput[] = [{ scopeType: ScopeType.GLOBAL }];
    if (scope.organizationId) {
      scopes.push({
        scopeType: ScopeType.ORGANIZATION,
        organizationId: scope.organizationId,
        user: { orgMemberships: { some: { organizationId: scope.organizationId, status: ACTIVE } } },
      });
    }
    if (scope.workspaceId) {
      const activeInWorkspace = {
        user: { memberships: { some: { workspaceId: scope.workspaceId, status: ACTIVE } } },
      };
      scopes.push({ scopeType: ScopeType.WORKSPACE, workspaceId: scope.workspaceId, ...activeInWorkspace });
      if (scope.projectId) {
        scopes.push({ scopeType: ScopeType.PROJECT, projectId: scope.projectId, ...activeInWorkspace });
      }
    }

    const count = await db.roleAssignment.count({
      where: {
        userId,
        revokedAt: null,
        role: { permissions: { some: { permission: { key: permissionKey } } } },
        OR: scopes,
      },
    });
    return count > 0;
  }

  async assertPermission(userId: string, permissionKey: string, scope: ResourceScope = {}, db: Db = this.prisma) {
    if (!(await this.hasPermission(userId, permissionKey, scope, db))) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to perform this action.',
      });
    }
  }

  /** Resolves a live workspace and asserts `permissionKey` on it. */
  async requireWorkspace(userId: string, workspaceId: string, permissionKey: string) {
    const workspace = await this.prisma.workspace.findFirst({ where: { id: workspaceId, deletedAt: null } });
    if (!workspace) {
      throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found.' });
    }
    await this.assertPermission(userId, permissionKey, { organizationId: workspace.organizationId, workspaceId: workspace.id });
    return workspace;
  }

  assertGlobalPermission(userId: string, permissionKey: string) {
    return this.assertPermission(userId, permissionKey, {});
  }

  /**
   * Prisma filter for projects the user holds `permissionKey` on, or null when
   * nothing is accessible. Applies the same membership rules as hasPermission.
   */
  async projectAccessFilter(userId: string, permissionKey: string): Promise<ProjectAccessFilter> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        revokedAt: null,
        role: { permissions: { some: { permission: { key: permissionKey } } } },
      },
      select: { scopeType: true, organizationId: true, workspaceId: true, projectId: true },
    });
    if (assignments.length === 0) return null;
    if (assignments.some((a) => a.scopeType === ScopeType.GLOBAL)) return {};

    const [orgMemberships, workspaceMemberships] = await Promise.all([
      this.prisma.organizationMembership.findMany({
        where: { userId, status: ACTIVE },
        select: { organizationId: true },
      }),
      this.prisma.workspaceMembership.findMany({
        where: { userId, status: ACTIVE },
        select: { workspaceId: true },
      }),
    ]);
    const activeOrgs = new Set(orgMemberships.map((m) => m.organizationId));
    const activeWorkspaces = [...new Set(workspaceMemberships.map((m) => m.workspaceId))];
    const activeWorkspaceSet = new Set(activeWorkspaces);

    const orgIds = new Set<string>();
    const workspaceIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const a of assignments) {
      if (a.scopeType === ScopeType.ORGANIZATION && a.organizationId && activeOrgs.has(a.organizationId)) {
        orgIds.add(a.organizationId);
      } else if (a.scopeType === ScopeType.WORKSPACE && a.workspaceId && activeWorkspaceSet.has(a.workspaceId)) {
        workspaceIds.add(a.workspaceId);
      } else if (a.scopeType === ScopeType.PROJECT && a.projectId) {
        projectIds.add(a.projectId);
      }
    }

    const or: Prisma.ProjectWhereInput[] = [];
    if (orgIds.size) or.push({ organizationId: { in: [...orgIds] } });
    if (workspaceIds.size) or.push({ workspaceId: { in: [...workspaceIds] } });
    if (projectIds.size && activeWorkspaces.length) {
      or.push({ id: { in: [...projectIds] }, workspaceId: { in: activeWorkspaces } });
    }
    return or.length ? { OR: or } : null;
  }

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { permissions: { select: { permission: { select: { key: true } } } } },
    });
  }

  async createRole(actorId: string, dto: CreateRoleDto, requestMeta?: RequestMeta) {
    await this.assertGlobalPermission(actorId, 'admin.role.manage');

    const normalizedKey = dto.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!/[A-Z0-9]/.test(normalizedKey)) {
      throw new BadRequestException({ code: 'INVALID_ROLE_KEY', message: 'Role key is invalid.' });
    }

    const existing = await this.prisma.role.findUnique({ where: { key: normalizedKey } });
    if (existing) {
      throw new ConflictException({ code: 'ROLE_KEY_EXISTS', message: 'A role with this key already exists.' });
    }

    const uniquePermissionKeys = [...new Set(dto.permissionKeys)];
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: uniquePermissionKeys } },
    });
    if (permissions.length !== uniquePermissionKeys.length) {
      const found = new Set(permissions.map((permission) => permission.key));
      const missing = uniquePermissionKeys.filter((key) => !found.has(key));
      throw new BadRequestException({
        code: 'UNKNOWN_PERMISSIONS',
        message: `Unknown permissions: ${missing.join(', ')}`,
      });
    }

    // Anti-escalation: a creator can only bundle permissions they hold globally.
    await this.assertHoldsAll(actorId, uniquePermissionKeys, {});

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          key: normalizedKey,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          isSystem: false,
          permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
        },
      });

      await this.audit.record(
        {
          actorUserId: actorId,
          action: 'role.create',
          targetType: 'role',
          targetId: role.id,
          afterState: { key: role.key, name: role.name, permissions: uniquePermissionKeys },
          requestMeta,
        },
        tx,
      );
      return role;
    });
  }

  async createAssignment(actorId: string, dto: CreateRoleAssignmentDto, requestMeta?: RequestMeta) {
    if (actorId === dto.userId) {
      throw new ForbiddenException({
        code: 'SELF_ASSIGNMENT_NOT_ALLOWED',
        message: 'You cannot assign a role to yourself.',
      });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Target user not found.' });
    }

    const scope = await this.validateAndResolveScope(dto);
    await this.assertPermission(actorId, 'admin.access.manage', scope);

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' });
    }

    // Anti-escalation: the grantor must already hold every permission at this scope.
    await this.assertHoldsAll(actorId, role.permissions.map((rp) => rp.permission.key), scope);
    await this.assertTargetUserMembership(dto.userId, dto.scopeType, scope);

    const target = this.assignmentTarget(dto);
    const activeDuplicate = await this.prisma.roleAssignment.findFirst({
      where: { userId: dto.userId, roleId: dto.roleId, scopeType: dto.scopeType, ...target, revokedAt: null },
    });
    if (activeDuplicate) {
      throw new ConflictException({
        code: 'ROLE_ASSIGNMENT_EXISTS',
        message: 'This active role assignment already exists.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.roleAssignment.create({
        data: {
          userId: dto.userId,
          roleId: dto.roleId,
          scopeType: dto.scopeType,
          ...target,
          createdBy: actorId,
        },
      });

      await this.audit.record(
        {
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
          requestMeta,
        },
        tx,
      );
      return assignment;
    });
  }

  async revokeAssignment(actorId: string, assignmentId: string, requestMeta?: RequestMeta) {
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: assignmentId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
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
    await this.assertHoldsAll(actorId, assignment.role.permissions.map((rp) => rp.permission.key), scope);

    return this.prisma.$transaction(async (tx) => {
      // Conditional update: a concurrent revocation leaves count = 0.
      const result = await tx.roleAssignment.updateMany({
        where: { id: assignment.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedBy: actorId },
      });
      if (result.count === 0) {
        throw new NotFoundException({ code: 'ROLE_ASSIGNMENT_NOT_FOUND', message: 'Active role assignment not found.' });
      }
      const saved = await tx.roleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });

      const state = {
        roleId: assignment.roleId,
        roleKey: assignment.role.key,
        userId: assignment.userId,
        scopeType: assignment.scopeType,
        ...scope,
      };
      await this.audit.record(
        {
          actorUserId: actorId,
          organizationId: scope.organizationId ?? null,
          workspaceId: scope.workspaceId ?? null,
          action: 'access.assignment.revoke',
          targetType: 'role_assignment',
          targetId: assignment.id,
          beforeState: { ...state, revokedAt: null },
          afterState: { ...state, revokedAt: saved.revokedAt?.toISOString() ?? null },
          requestMeta,
        },
        tx,
      );
      return saved;
    });
  }

  async listAssignments(limit = 100) {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: { revokedAt: null },
      include: {
        role: { select: { id: true, key: true, name: true } },
        user: { select: { id: true, email: true, displayName: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    return assignments.map((assignment) => ({
      id: assignment.id,
      user: assignment.user,
      role: assignment.role,
      scopeType: assignment.scopeType,
      organizationId: assignment.organizationId,
      workspaceId: assignment.workspaceId,
      projectId: assignment.projectId,
      createdBy: assignment.createdBy,
      createdAt: assignment.createdAt,
    }));
  }

  private async assertHoldsAll(actorId: string, permissionKeys: string[], scope: ResourceScope) {
    for (const key of permissionKeys) {
      await this.assertPermission(actorId, key, scope);
    }
  }

  /** Exactly the target column for the scope type is set; the others are null. */
  private assignmentTarget(dto: CreateRoleAssignmentDto) {
    return {
      organizationId: dto.scopeType === ScopeType.ORGANIZATION ? dto.organizationId! : null,
      workspaceId: dto.scopeType === ScopeType.WORKSPACE ? dto.workspaceId! : null,
      projectId: dto.scopeType === ScopeType.PROJECT ? dto.projectId! : null,
    };
  }

  private async validateAndResolveScope(dto: CreateRoleAssignmentDto): Promise<ResourceScope> {
    const supplied = [dto.organizationId, dto.workspaceId, dto.projectId].filter(Boolean).length;
    switch (dto.scopeType) {
      case ScopeType.GLOBAL:
        if (supplied !== 0) throw this.invalidScope();
        return {};
      case ScopeType.ORGANIZATION: {
        if (!dto.organizationId || supplied !== 1) throw this.invalidScope();
        const organization = await this.prisma.organization.findUnique({ where: { id: dto.organizationId } });
        if (!organization) {
          throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });
        }
        return { organizationId: organization.id };
      }
      case ScopeType.WORKSPACE: {
        if (!dto.workspaceId || supplied !== 1) throw this.invalidScope();
        return this.workspaceScope(dto.workspaceId);
      }
      case ScopeType.PROJECT: {
        if (!dto.projectId || supplied !== 1) throw this.invalidScope();
        return this.projectScope(dto.projectId);
      }
      default:
        throw this.invalidScope();
    }
  }

  private async workspaceScope(workspaceId: string): Promise<ResourceScope> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found.' });
    return { organizationId: workspace.organizationId, workspaceId: workspace.id };
  }

  private async projectScope(projectId: string): Promise<ResourceScope> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
    return { organizationId: project.organizationId, workspaceId: project.workspaceId, projectId: project.id };
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
      const membership = await this.prisma.organizationMembership.findFirst({
        where: { userId, organizationId: scope.organizationId!, status: ACTIVE },
      });
      if (!membership) {
        throw new BadRequestException({
          code: 'TARGET_USER_NOT_IN_ORGANIZATION',
          message: 'The target user is not an active member of this organization.',
        });
      }
      return;
    }

    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { userId, workspaceId: scope.workspaceId!, status: ACTIVE },
    });
    if (!membership) {
      throw new BadRequestException({
        code: 'TARGET_USER_NOT_IN_WORKSPACE',
        message: 'The target user is not an active member of this workspace.',
      });
    }
  }

  private async scopeFromAssignment(assignment: RoleAssignment): Promise<ResourceScope> {
    switch (assignment.scopeType) {
      case ScopeType.GLOBAL:
        return {};
      case ScopeType.ORGANIZATION:
        return { organizationId: assignment.organizationId! };
      case ScopeType.WORKSPACE:
        return this.workspaceScope(assignment.workspaceId!);
      case ScopeType.PROJECT:
        return this.projectScope(assignment.projectId!);
    }
  }
}
