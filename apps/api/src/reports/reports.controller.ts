import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ReportType } from '@prisma/client';
import { Request, Response } from 'express';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { ProjectsService } from '../projects/projects.service';
import { ReportsService, SECTION_KEYS, SectionKey } from './reports.service';

class GenerateDto {
  @IsEnum(ReportType) type: ReportType;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsDateString() periodStart?: string;
  @IsOptional() @IsDateString() periodEnd?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsIn(SECTION_KEYS as unknown as string[], { each: true }) sections?: SectionKey[];
}
class ScheduleDto {
  @IsString() @MinLength(1) @MaxLength(160) name: string;
  @IsEnum(ReportType) reportType: ReportType;
  @IsIn(['WEEKLY', 'MONTHLY']) cadence: 'WEEKLY' | 'MONTHLY';
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
}
class UpdateScheduleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @IsIn(['WEEKLY', 'MONTHLY']) cadence?: 'WEEKLY' | 'MONTHLY';
  @IsOptional() @IsBoolean() enabled?: boolean;
}

@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly projects: ProjectsService,
  ) {}

  private async projectIds(userId: string) {
    return (await this.projects.listAccessible(userId)).map((p) => p.id);
  }

  @Post('user/projects/:projectId/reports')
  generate(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: GenerateDto, @Req() req: Request) {
    return this.reports.generate(a.userId, id, dto, requestMeta(req));
  }

  @Get('user/reports')
  async list(@CurrentActor() a: AuthenticatedActor, @Query() q: Record<string, string>) {
    return this.reports.list(a.userId, await this.projectIds(a.userId), { type: q.type, status: q.status, projectId: q.projectId, scheduled: q.scheduled === 'true' });
  }

  @Get('user/reports/shared')
  async shared(@CurrentActor() a: AuthenticatedActor) {
    return this.reports.shared(a.userId, await this.projectIds(a.userId));
  }

  @Get('user/reports/:id')
  get(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.get(a.userId, id);
  }

  @Get('user/reports/:id/download/:format')
  async download(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Param('format') format: string, @Res() res: Response) {
    const f = await this.reports.file(a.userId, id, format);
    res.setHeader('content-type', f.contentType);
    res.setHeader('content-disposition', `${format === 'html' ? 'inline' : 'attachment'}; filename="${f.filename}"`);
    if (format === 'html') res.setHeader('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.send(f.body);
  }

  @Delete('user/reports/:id')
  remove(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.reports.remove(a.userId, id, requestMeta(req));
  }

  @Post('user/reports/:id/shares')
  share(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.reports.share(a.userId, id, requestMeta(req));
  }

  @Post('user/report-shares/:id/revoke')
  revoke(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.reports.revokeShare(a.userId, id, requestMeta(req));
  }

  @Public()
  @Get('public/reports/:token')
  publicView(@Param('token') token: string) {
    return this.reports.publicView(token);
  }

  @Get('user/report-schedules')
  async schedules(@CurrentActor() a: AuthenticatedActor) {
    return this.reports.schedules(a.userId, await this.projectIds(a.userId));
  }

  @Post('user/projects/:projectId/report-schedules')
  createSchedule(@CurrentActor() a: AuthenticatedActor, @Param('projectId', ParseUUIDPipe) id: string, @Body() dto: ScheduleDto) {
    return this.reports.createSchedule(a.userId, id, dto);
  }

  @Patch('user/report-schedules/:id')
  updateSchedule(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScheduleDto) {
    return this.reports.updateSchedule(a.userId, id, dto);
  }

  @Delete('user/report-schedules/:id')
  deleteSchedule(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.deleteSchedule(a.userId, id);
  }
}
