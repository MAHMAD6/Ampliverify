import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Request, Response } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { SOURCES, SourceKey, ValuationSettings } from './valuation-engine';
import { ValuationService } from './valuation.service';

class DomainDto {
  @IsString() @MaxLength(2048) domain: string;
  @IsOptional() @IsUUID() workspaceId?: string;
}

class BusinessDto {
  @IsOptional() @IsNumber() @Min(0) @Max(1e11) monthlyRevenue?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1e12) annualRevenue?: number;
  @IsOptional() @Matches(/^\d{1,2}-\d{1,3}$/) profitMargin?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1e10) monthlyVisits?: number;
}

class PreviewDto {
  @IsOptional() @ValidateNested() @Type(() => BusinessDto) business?: BusinessDto;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsIn([...SOURCES], { each: true }) planned?: SourceKey[];
}

class Ga4Ref {
  @IsUUID() integrationId: string;
  @IsString() @Matches(/^properties\/\d+$/) propertyId: string;
}
class GscRef {
  @IsUUID() integrationId: string;
  @IsString() @MaxLength(2048) siteUrl: string;
}

class VerifyDto extends BusinessDto {
  @IsOptional() @ValidateNested() @Type(() => Ga4Ref) ga4?: Ga4Ref;
  @IsOptional() @ValidateNested() @Type(() => GscRef) gsc?: GscRef;
  @IsOptional() @IsString() @MaxLength(80) businessModel?: string;
  @IsOptional() @IsString() @MaxLength(80) industry?: string;
  @IsOptional() @IsString() @MaxLength(80) audience?: string;
  @IsOptional() @IsString() @MaxLength(80) trafficSource?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

class SettingsDto {
  @IsObject() settings: Record<string, unknown>;
}

@Controller()
export class ValuationController {
  constructor(private readonly valuation: ValuationService) {}

  // ── Public ────────────────────────────────────────────────────────────────
  @Public()
  @Get('public/valuations/config')
  config() {
    return this.valuation.publicConfig();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public/valuations')
  create(@Body() dto: DomainDto, @Req() req: Request) {
    return this.valuation.createEstimate({ domain: dto.domain }, requestMeta(req));
  }

  @Public()
  @Get('public/valuations/:id')
  report(@Param('id', ParseUUIDPipe) id: string) {
    return this.valuation.report(id);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('public/valuations/:id/preview')
  preview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PreviewDto) {
    return this.valuation.preview(id, dto.business ?? {}, dto.planned ?? []);
  }

  @Public()
  @Get('public/valuations/:id/pdf')
  async pdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const f = await this.valuation.pdf(id);
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `attachment; filename="${f.filename.replace(/[^a-z0-9.-]/gi, '-')}"`);
    res.send(f.body);
  }

  @Public()
  @Get('public/valuations/:id/json')
  json(@Param('id', ParseUUIDPipe) id: string) {
    return this.valuation.json(id);
  }

  // ── Signed-in users ───────────────────────────────────────────────────────
  @Post('user/valuations')
  createMine(@CurrentActor() a: AuthenticatedActor, @Body() dto: DomainDto, @Req() req: Request) {
    return this.valuation.createEstimate({ domain: dto.domain, userId: a.userId, workspaceId: dto.workspaceId }, requestMeta(req));
  }

  @Get('user/valuations')
  mine(@CurrentActor() a: AuthenticatedActor) {
    return this.valuation.myValuations(a.userId);
  }

  @Post('user/valuations/:id/verify')
  verify(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDto, @Req() req: Request) {
    return this.valuation.createVerified(a.userId, id, dto, requestMeta(req));
  }

  // ── Super Admin ───────────────────────────────────────────────────────────
  @Get('admin/valuation/settings')
  settings(@CurrentActor() a: AuthenticatedActor) {
    return this.valuation.adminSettings(a.userId);
  }

  @Put('admin/valuation/settings')
  save(@CurrentActor() a: AuthenticatedActor, @Body() dto: SettingsDto, @Req() req: Request) {
    return this.valuation.updateSettings(a.userId, dto.settings as unknown as ValuationSettings, requestMeta(req));
  }

  @Post('admin/valuation/settings/reset')
  async reset(@CurrentActor() a: AuthenticatedActor, @Req() req: Request) {
    const { defaults } = await this.valuation.adminSettings(a.userId);
    return this.valuation.updateSettings(a.userId, defaults, requestMeta(req), true);
  }

  @Post('admin/valuation/test')
  test(@CurrentActor() a: AuthenticatedActor, @Body() dto: DomainDto) {
    return this.valuation.createTest(a.userId, dto.domain);
  }

  @Get('admin/valuation/history')
  history(@CurrentActor() a: AuthenticatedActor, @Query('kind') kind?: string, @Query('status') status?: string, @Query('domain') domain?: string) {
    return this.valuation.history(a.userId, { kind, status, domain });
  }

  @Get('admin/valuation/valuations/:id')
  adminReport(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.valuation.adminReport(a.userId, id);
  }

  @Get('admin/valuation/sources')
  sources(@CurrentActor() a: AuthenticatedActor) {
    return this.valuation.sources(a.userId);
  }

  @Get('admin/valuation/changes')
  changes(@CurrentActor() a: AuthenticatedActor, @Query('take') take?: string) {
    return this.valuation.changes(a.userId, take ? Number(take) || 25 : 25);
  }

  @Get('admin/valuation/usage')
  usage(@CurrentActor() a: AuthenticatedActor) {
    return this.valuation.usage(a.userId);
  }
}
