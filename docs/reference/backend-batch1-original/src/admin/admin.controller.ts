import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { UsersService } from '../users/users.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { CreateRoleDto } from '../rbac/dto/create-role.dto';
import { CreateRoleAssignmentDto } from '../rbac/dto/create-role-assignment.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  async listUsers(@CurrentActor() actor: AuthenticatedActor) {
    await this.rbac.assertGlobalPermission(actor.userId, 'user.read');
    return this.users.listAll();
  }

  @Get('users/:id')
  async getUser(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id') id: string,
  ) {
    await this.rbac.assertGlobalPermission(actor.userId, 'user.read');
    return this.users.findByIdOrThrow(id);
  }

  @Get('roles')
  async listRoles(@CurrentActor() actor: AuthenticatedActor) {
    await this.rbac.assertGlobalPermission(actor.userId, 'admin.role.manage');
    return this.rbac.listRoles();
  }

  @Post('roles')
  createRole(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateRoleDto,
    @Req() request: Request,
  ) {
    return this.rbac.createRole(actor.userId, dto, this.requestMeta(request));
  }

  @Get('access-assignments')
  async listAssignments(@CurrentActor() actor: AuthenticatedActor) {
    await this.rbac.assertGlobalPermission(actor.userId, 'admin.access.manage');
    return this.rbac.listAssignments();
  }

  @Post('access-assignments')
  createAssignment(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateRoleAssignmentDto,
    @Req() request: Request,
  ) {
    return this.rbac.createAssignment(actor.userId, dto, this.requestMeta(request));
  }

  @Post('access-assignments/:id/revoke')
  revokeAssignment(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.rbac.revokeAssignment(actor.userId, id, this.requestMeta(request));
  }

  @Get('audit-events')
  async listAuditEvents(
    @CurrentActor() actor: AuthenticatedActor,
    @Query('limit') limit?: string,
  ) {
    await this.rbac.assertGlobalPermission(actor.userId, 'audit.read');
    const parsed = limit ? Number.parseInt(limit, 10) : 100;
    return this.audit.list(Number.isFinite(parsed) ? parsed : 100);
  }

  private requestMeta(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    };
  }
}
