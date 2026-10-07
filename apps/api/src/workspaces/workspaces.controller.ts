import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Type } from 'class-transformer';
import { Request, Response } from 'express';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { TenantRole, WorkspacesService } from './workspaces.service';

class AiGeoSettingsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) defaultPlatforms?: string[];
  @IsOptional() @IsString() @MaxLength(10) defaultCountry?: string;
  @IsOptional() @IsString() @MaxLength(10) defaultLanguage?: string;
  @IsOptional() @IsString() @MaxLength(120) brandName?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) brandAliases?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) competitors?: string[];
  @IsOptional() @IsIn(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY']) checkFrequency?: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  @IsOptional() @IsString() @MaxLength(60) aiTone?: string;
  @IsOptional() @IsIn(['LOW', 'BALANCED', 'HIGH']) aiCreativity?: 'LOW' | 'BALANCED' | 'HIGH';
  @IsOptional() @IsBoolean() autoApplySuggestions?: boolean;
  @IsOptional() @IsNumber() @Min(0) monthlyCreditCap?: number | null;
}

class PrivacySettingsDto {
  @IsOptional() @IsInt() @Min(30) @Max(3650) retentionDays?: number | null;
  @IsOptional() @IsBoolean() allowPublicReportShares?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(365) shareLinkExpiryDays?: number;
}

class ProjectDefaultsDto {
  @IsOptional() @IsIn(['PAGE', 'SITE']) crawlScope?: 'PAGE' | 'SITE';
  @IsOptional() @IsInt() @Min(1) @Max(200) maxPages?: number;
  @IsOptional() @IsIn(['SEO', 'GEO', 'BOTH']) auditMode?: 'SEO' | 'GEO' | 'BOTH';
  @IsOptional() @IsIn(['MANUAL', 'WEEKLY', 'MONTHLY']) auditFrequency?: 'MANUAL' | 'WEEKLY' | 'MONTHLY';
  @IsOptional() @IsIn(['NONE', 'WEEKLY', 'MONTHLY']) reportFrequency?: 'NONE' | 'WEEKLY' | 'MONTHLY';
}

class WorkspaceSettingsDto {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AiGeoSettingsDto) aiGeo?: AiGeoSettingsDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PrivacySettingsDto) privacy?: PrivacySettingsDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ProjectDefaultsDto) projectDefaults?: ProjectDefaultsDto;
}

class UpdateWorkspaceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsString() @MaxLength(10) language?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => WorkspaceSettingsDto) settings?: WorkspaceSettingsDto;
}

class InviteDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsIn(['OWNER', 'MEMBER']) roleKey: TenantRole;
}

class RoleDto {
  @IsIn(['OWNER', 'MEMBER']) roleKey: TenantRole;
}

class TokenDto {
  @IsString() @MinLength(20) @MaxLength(200) token: string;
}

class PrivacyDto {
  @IsOptional() @IsBoolean() productAnalytics?: boolean;
  @IsOptional() @IsBoolean() productEmails?: boolean;
}

class ProfileDto {
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
}

class TicketDto {
  @IsUUID() workspaceId: string;
  @IsString() @MinLength(3) @MaxLength(200) subject: string;
  @IsIn(['GENERAL', 'BILLING', 'TECHNICAL', 'ACCOUNT', 'FEATURE_REQUEST', 'BUG']) category: string;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsString() @MinLength(10) @MaxLength(5000) message: string;
}

class ReplyDto {
  @IsString() @MinLength(1) @MaxLength(5000) body: string;
}

@Controller()
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get('user/workspaces/:id')
  get(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.workspaces.get(a.userId, id);
  }

  @Patch('user/workspaces/:id')
  update(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkspaceDto, @Req() req: Request) {
    return this.workspaces.update(a.userId, id, dto, requestMeta(req));
  }

  @Get('user/workspaces/:id/members')
  members(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.workspaces.members(a.userId, id);
  }

  @Put('user/workspaces/:id/members/:userId/role')
  setRole(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: RoleDto, @Req() req: Request) {
    return this.workspaces.setMemberRole(a.userId, id, userId, dto.roleKey, requestMeta(req));
  }

  @Delete('user/workspaces/:id/members/:userId')
  removeMember(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: Request) {
    return this.workspaces.removeMember(a.userId, id, userId, requestMeta(req));
  }

  @Get('user/workspaces/:id/invitations')
  invitations(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.workspaces.invitations(a.userId, id);
  }

  @Post('user/workspaces/:id/invitations')
  invite(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InviteDto, @Req() req: Request) {
    return this.workspaces.invite(a.userId, id, dto.email, dto.roleKey, requestMeta(req));
  }

  @Post('user/invitations/:id/revoke')
  revoke(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.workspaces.revokeInvitation(a.userId, id, requestMeta(req));
  }

  @Public()
  @Get('public/invitations/:token')
  preview(@Param('token') token: string) {
    return this.workspaces.previewInvitation(token);
  }

  @Post('user/invitations/accept')
  accept(@CurrentActor() a: AuthenticatedActor, @Body() dto: TokenDto, @Req() req: Request) {
    return this.workspaces.acceptInvitation(a.userId, dto.token, requestMeta(req));
  }

  @Get('user/workspaces/:id/exports')
  exports(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.workspaces.exports(a.userId, id);
  }

  @Post('user/workspaces/:id/exports')
  requestExport(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.workspaces.requestExport(a.userId, id, requestMeta(req));
  }

  /** Streams the export file (not wrapped in the JSON envelope). */
  @Get('user/exports/:id/download')
  async download(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.workspaces.downloadExport(a.userId, id);
    res.setHeader('content-type', 'application/json');
    res.setHeader('content-disposition', `attachment; filename="${file.filename}"`);
    res.send(file.body);
  }

  @Get('user/me/privacy')
  privacy(@CurrentActor() a: AuthenticatedActor) {
    return this.workspaces.privacy(a.userId);
  }

  @Put('user/me/privacy')
  setPrivacy(@CurrentActor() a: AuthenticatedActor, @Body() dto: PrivacyDto) {
    return this.workspaces.setPrivacy(a.userId, dto);
  }

  @Patch('user/me')
  profile(@CurrentActor() a: AuthenticatedActor, @Body() dto: ProfileDto) {
    return this.workspaces.updateProfile(a.userId, dto);
  }

  @Get('user/support-tickets')
  tickets(@CurrentActor() a: AuthenticatedActor, @Query('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspaces.tickets(a.userId, workspaceId);
  }

  @Post('user/support-tickets')
  createTicket(@CurrentActor() a: AuthenticatedActor, @Body() dto: TicketDto, @Req() req: Request) {
    return this.workspaces.createTicket(a.userId, dto, requestMeta(req));
  }

  @Get('user/support-tickets/:id')
  ticket(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.workspaces.ticket(a.userId, id);
  }

  @Post('user/support-tickets/:id/messages')
  reply(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyDto) {
    return this.workspaces.replyTicket(a.userId, id, dto.body);
  }
}
