import { Body, Controller, Get, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { OrganizationsService } from './organizations.service';

@Controller('user')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('organizations')
  listOrganizations(@CurrentActor() actor: AuthenticatedActor) {
    return this.organizations.listOrganizationsForUser(actor.userId);
  }

  @Post('organizations')
  createOrganization(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateOrganizationDto,
    @Req() request: Request,
  ) {
    return this.organizations.createOrganization(actor.userId, dto, requestMeta(request));
  }

  @Get('workspaces')
  listWorkspaces(
    @CurrentActor() actor: AuthenticatedActor,
    @Query('organizationId', new ParseUUIDPipe({ optional: true })) organizationId?: string,
  ) {
    return this.organizations.listWorkspacesForUser(actor.userId, organizationId);
  }

  @Post('workspaces')
  createWorkspace(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateWorkspaceDto,
    @Req() request: Request,
  ) {
    return this.organizations.createWorkspace(actor.userId, dto, requestMeta(request));
  }
}
