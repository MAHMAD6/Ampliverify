import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { GeoPromptStatus, TaskStatus } from '@prisma/client';
import { Request } from 'express';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { Public } from '../common/decorators/public.decorator';
import { Cadence, GeoService } from './geo.service';

class CreatePromptDto {
  @IsString() @MinLength(3) @MaxLength(500) prompt: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) platformKeys?: string[];
  @IsOptional() @IsString() @Length(2, 2) country?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsIn(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY']) cadence?: Cadence;
  @IsOptional() @IsBoolean() runNow?: boolean;
}

class UpdatePromptDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(500) prompt?: string;
  @IsOptional() @IsEnum(GeoPromptStatus) status?: GeoPromptStatus;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) platformKeys?: string[];
  @IsOptional() @IsString() @Length(2, 2) country?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsIn(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY']) cadence?: Cadence;
}

class RunDto {
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) platformKeys?: string[];
}

class CompetitorDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(253) domain?: string | null;
}

class OpportunityDto {
  @IsEnum(TaskStatus) status: TaskStatus;
}

const days = (period?: string) => ({ '7d': 7, '30d': 30, '90d': 90, '12m': 365 })[period ?? '30d'] ?? 30;

@Controller()
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Public()
  @Get('public/geo-platforms/status')
  platforms() {
    return this.geo.platforms();
  }

  @Get('user/projects/:projectId/geo/overview')
  overview(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('period') period?: string) {
    return this.geo.overview(a.userId, id, days(period));
  }

  @Get('user/projects/:projectId/geo/prompts')
  prompts(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query() q: Record<string, string>) {
    return this.geo.listPrompts(a.userId, id, q);
  }

  @Post('user/projects/:projectId/geo/prompts')
  create(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: CreatePromptDto, @Req() req: Request) {
    return this.geo.createPrompt(a.userId, id, dto, requestMeta(req));
  }

  @Get('user/geo/prompts/:id')
  prompt(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.geo.getPrompt(a.userId, id);
  }

  @Patch('user/geo/prompts/:id')
  update(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromptDto, @Req() req: Request) {
    return this.geo.updatePrompt(a.userId, id, dto, requestMeta(req));
  }

  @Post('user/geo/prompts/:id/duplicate')
  duplicate(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.geo.duplicatePrompt(a.userId, id, requestMeta(req));
  }

  @Post('user/geo/prompts/:id/run')
  run(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RunDto, @Req() req: Request) {
    return this.geo.runCheck(a.userId, id, dto, requestMeta(req));
  }

  @Get('user/projects/:projectId/geo/citations')
  citations(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('period') period?: string) {
    return this.geo.citations(a.userId, id, days(period));
  }

  @Get('user/projects/:projectId/geo/competitors')
  competitors(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('period') period?: string) {
    return this.geo.competitors(a.userId, id, days(period));
  }

  @Post('user/projects/:projectId/geo/competitors')
  addCompetitor(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: CompetitorDto, @Req() req: Request) {
    return this.geo.addCompetitor(a.userId, id, dto, requestMeta(req));
  }

  @Delete('user/geo/competitors/:id')
  removeCompetitor(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.geo.removeCompetitor(a.userId, id, requestMeta(req));
  }

  @Get('user/projects/:projectId/geo/history')
  history(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.geo.history(a.userId, id);
  }

  @Get('user/projects/:projectId/geo/opportunities')
  opportunities(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Query('status') status?: TaskStatus) {
    return this.geo.opportunities(a.userId, id, status && status in TaskStatus ? status : undefined);
  }

  @Patch('user/geo/opportunities/:id')
  setOpportunity(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OpportunityDto) {
    return this.geo.setOpportunityStatus(a.userId, id, dto.status);
  }
}
