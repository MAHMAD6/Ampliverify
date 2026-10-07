import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { FindingStatus } from '@prisma/client';
import { Request } from 'express';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { AuditsService } from './audits.service';
import { RULES } from './rules';

class RequestAuditDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsIn(['PAGE', 'SITE'])
  scope?: 'PAGE' | 'SITE';

  @IsOptional()
  @IsIn(['SEO', 'GEO', 'BOTH'])
  mode?: 'SEO' | 'GEO' | 'BOTH';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxPages?: number;
}

class FindingStatusDto {
  @IsEnum(FindingStatus)
  status: FindingStatus;
}

@Controller('user')
export class AuditsController {
  constructor(private readonly audits: AuditsService) {}

  /** The rule catalogue (what is checked, why it matters). */
  @Get('audit-rules')
  rules() {
    return RULES;
  }

  @Post('projects/:projectId/audits')
  request(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: RequestAuditDto,
    @Req() req: Request,
  ) {
    return this.audits.request(actor.userId, projectId, dto, requestMeta(req));
  }

  @Get('projects/:projectId/audits')
  list(@CurrentActor() actor: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) projectId: string, @Query('limit') limit?: string) {
    return this.audits.list(actor.userId, projectId, limit ? Number(limit) : undefined);
  }

  @Get('projects/:projectId/audits/latest')
  latest(@CurrentActor() actor: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) projectId: string, @Query('url') url?: string) {
    return this.audits.latest(actor.userId, projectId, url);
  }

  @Get('audits/:id')
  get(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.audits.get(actor.userId, id);
  }

  @Post('audits/:id/cancel')
  cancel(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.audits.cancel(actor.userId, id, requestMeta(req));
  }

  @Patch('findings/:id')
  setStatus(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FindingStatusDto,
    @Req() req: Request,
  ) {
    return this.audits.setFindingStatus(actor.userId, id, dto.status, requestMeta(req));
  }
}
