import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IncidentStatus, UserStatus } from '@prisma/client';
import { Request } from 'express';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  Allow,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { OperationsService } from './operations.service';

class ModuleDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class CreateFlagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  key: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsIn(['production', 'staging', 'development'])
  environment: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class FlagRuleDto {
  @IsIn(['WORKSPACE', 'ORGANIZATION', 'USER', 'PLAN', 'PERCENTAGE'])
  scopeType: string;

  @IsString()
  @MaxLength(200)
  scopeValue: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number | null;

  @IsInt()
  @Min(0)
  priority: number;
}

class UpdateFlagDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FlagRuleDto)
  rules?: FlagRuleDto[];
}

class SettingDto {
  /** Any JSON value, including null (validated per key by the service). */
  @Allow()
  value: unknown;
}

class UserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status: UserStatus;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

class IncidentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  publicSummary?: string;
}

class IncidentUpdateDto {
  @IsEnum(IncidentStatus)
  status: IncidentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  publicSummary?: string;
}

/** Platform operations for the Super Admin console. Reads need `system.read`, writes `system.manage`. */
@Controller('admin')
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}

  @Get('module-controls')
  moduleControls(@CurrentActor() actor: AuthenticatedActor) {
    return this.ops.moduleList(actor.userId);
  }

  @Put('module-controls/:key')
  setModule(@CurrentActor() actor: AuthenticatedActor, @Param('key') key: string, @Body() dto: ModuleDto, @Req() req: Request) {
    return this.ops.setModule(actor.userId, key, dto.enabled, dto.reason, requestMeta(req));
  }

  @Get('feature-flags')
  async featureFlags(@CurrentActor() actor: AuthenticatedActor) {
    return this.ops.listFlags(actor.userId);
  }

  @Post('feature-flags')
  createFlag(@CurrentActor() actor: AuthenticatedActor, @Body() dto: CreateFlagDto, @Req() req: Request) {
    return this.ops.createFlag(actor.userId, dto, requestMeta(req));
  }

  @Get('feature-flags/:id')
  flag(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.ops.getFlag(actor.userId, id);
  }

  @Patch('feature-flags/:id')
  updateFlag(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFlagDto, @Req() req: Request) {
    return this.ops.updateFlag(actor.userId, id, dto, requestMeta(req));
  }

  @Get('settings')
  settings(@CurrentActor() actor: AuthenticatedActor) {
    return this.ops.listSettings(actor.userId);
  }

  @Put('settings/:key')
  setSetting(@CurrentActor() actor: AuthenticatedActor, @Param('key') key: string, @Body() dto: SettingDto, @Req() req: Request) {
    return this.ops.setSetting(actor.userId, key, dto.value, requestMeta(req));
  }

  @Get('users/:id/detail')
  userDetail(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.ops.userDetail(actor.userId, id);
  }

  @Post('users/:id/status')
  setUserStatus(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UserStatusDto, @Req() req: Request) {
    return this.ops.setUserStatus(actor.userId, id, dto.status, dto.reason, requestMeta(req));
  }

  @Get('workspaces')
  workspaces(@CurrentActor() actor: AuthenticatedActor, @Query('q') q?: string) {
    return this.ops.listWorkspaces(actor.userId, q);
  }

  @Get('usage')
  usage(@CurrentActor() actor: AuthenticatedActor, @Query('days') days?: string) {
    return this.ops.usageAndCosts(actor.userId, days ? Number(days) : undefined);
  }

  @Get('health')
  health(@CurrentActor() actor: AuthenticatedActor) {
    return this.ops.health(actor.userId);
  }

  @Post('incidents')
  createIncident(@CurrentActor() actor: AuthenticatedActor, @Body() dto: IncidentDto, @Req() req: Request) {
    return this.ops.createIncident(actor.userId, dto, requestMeta(req));
  }

  @Patch('incidents/:id')
  updateIncident(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IncidentUpdateDto, @Req() req: Request) {
    return this.ops.updateIncident(actor.userId, id, dto, requestMeta(req));
  }

  @Post('jobs/:id/retry')
  retryJob(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.ops.retryJob(actor.userId, id, requestMeta(req));
  }

  @Get('search')
  search(@CurrentActor() actor: AuthenticatedActor, @Query('q') q = '') {
    return this.ops.search(actor.userId, q);
  }
}
