import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { UsersService } from '../users/users.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { CreateRoleDto } from '../rbac/dto/create-role.dto';
import { CreateRoleAssignmentDto } from '../rbac/dto/create-role-assignment.dto';

/** Super Admin foundation. Every route checks a GLOBAL or scope-aware permission. */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  async listUsers(
    @CurrentActor() actor: AuthenticatedActor,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    await this.rbac.assertGlobalPermission(actor.userId, 'user.read');
    return this.users.listAll(limit);
  }

  @Get('users/:id')
  async getUser(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    await this.rbac.assertGlobalPermission(actor.userId, 'user.read');
    return this.users.findByIdOrThrow(id);
  }

  @Get('roles')
  async listRoles(@CurrentActor() actor: AuthenticatedActor) {
    await this.rbac.assertGlobalPermission(actor.userId, 'admin.role.manage');
    return this.rbac.listRoles();
  }

  @Post('roles')
  createRole(@CurrentActor() actor: AuthenticatedActor, @Body() dto: CreateRoleDto, @Req() request: Request) {
    return this.rbac.createRole(actor.userId, dto, requestMeta(request));
  }

  @Get('access-assignments')
  async listAssignments(
    @CurrentActor() actor: AuthenticatedActor,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    await this.rbac.assertGlobalPermission(actor.userId, 'admin.access.manage');
    return this.rbac.listAssignments(limit);
  }

  @Post('access-assignments')
  createAssignment(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateRoleAssignmentDto,
    @Req() request: Request,
  ) {
    return this.rbac.createAssignment(actor.userId, dto, requestMeta(request));
  }

  @Post('access-assignments/:id/revoke')
  revokeAssignment(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ) {
    return this.rbac.revokeAssignment(actor.userId, id, requestMeta(request));
  }

  @Get('audit-logs')
  async listAuditLogs(
    @CurrentActor() actor: AuthenticatedActor,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    await this.rbac.assertGlobalPermission(actor.userId, 'audit.read');
    return this.audit.list(limit);
  }
}
