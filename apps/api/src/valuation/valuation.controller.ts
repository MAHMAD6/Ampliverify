import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Request, Response } from 'express';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { ValuationService } from './valuation.service';

class CreateDto {
  @IsString() @MaxLength(2048) domain: string;
  @IsOptional() @IsIn(['public']) mode?: 'public';
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) consentVersion: string;
  @IsOptional() @IsString() @Matches(/^[\w.:-]{8,100}$/) idempotencyKey?: string;
}

class FinancialDto {
  @IsOptional() @IsNumber() @Min(0) @Max(1e12) ttmRevenue?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1e12) ttmExpenses?: number;
  @IsOptional() @IsNumber() @Min(-1e12) @Max(1e12) ttmProfit?: number;
  @IsOptional() @IsString() @MaxLength(80) businessModel?: string;
}

class Ga4Ref {
  @IsUUID() integrationId: string;
  @IsString() @Matches(/^properties\/\d+$/) propertyId: string;
}
class GscRef {
  @IsUUID() integrationId: string;
  @IsString() @MaxLength(2048) siteUrl: string;
}

class VerifyDto {
  @IsOptional() @ValidateNested() @Type(() => Ga4Ref) ga4?: Ga4Ref;
  @IsOptional() @ValidateNested() @Type(() => GscRef) gsc?: GscRef;
  @IsOptional() @ValidateNested() @Type(() => FinancialDto) financial?: FinancialDto;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) consentVersion: string;
  @IsOptional() @IsBoolean() acceptAssumptions?: boolean;
  @IsOptional() @IsString() @Matches(/^[\w.:-]{8,100}$/) idempotencyKey?: string;
}

class PreviewDto {
  @IsOptional() @ValidateNested() @Type(() => FinancialDto) financial?: FinancialDto;
  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsIn(['gsc', 'ga4'], { each: true }) planned?: ('gsc' | 'ga4')[];
}

class ConfigDto {
  @IsObject() config: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class TestDto {
  @IsString() @MaxLength(2048) domain: string;
}

const sendPdf = (res: Response, f: { filename: string; body: Buffer }) => {
  res.setHeader('content-type', 'application/pdf');
  res.setHeader('content-disposition', `attachment; filename="${f.filename.replace(/[^a-z0-9.-]/gi, '-')}"`);
  res.setHeader('cache-control', 'private, no-store');
  res.send(f.body);
};

/** Website Value Calculator routes (V1 manual §06). Non-owners need the share token (`?t=`). */
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
  create(@Body() dto: CreateDto, @Req() req: Request) {
    return this.valuation.createEstimate({ domain: dto.domain, consentVersion: dto.consentVersion, idempotencyKey: dto.idempotencyKey }, requestMeta(req));
  }

  @Public()
  @Get('public/valuations/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @Query('t') t?: string) {
    return this.valuation.get(id, { token: t });
  }

  @Public()
  @Get('public/valuations/:id/evidence')
  evidence(@Param('id', ParseUUIDPipe) id: string, @Query('t') t?: string) {
    return this.valuation.evidence(id, { token: t });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('public/valuations/:id/report')
  async report(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response, @Query('t') t?: string) {
    sendPdf(res, await this.valuation.pdf(id, { token: t }));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('public/valuations/:id/preview')
  preview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PreviewDto, @Query('t') t?: string) {
    return this.valuation.preview(id, { token: t }, dto.financial ?? {}, dto.planned ?? []);
  }

  @Public()
  @Post('public/valuations/:id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Query('t') t?: string) {
    return this.valuation.cancel(id, { token: t });
  }

  // ── Signed-in users (owner access without a token) ────────────────────────
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('user/valuations')
  createMine(@CurrentActor() a: AuthenticatedActor, @Body() dto: CreateDto, @Req() req: Request) {
    return this.valuation.createEstimate({ domain: dto.domain, consentVersion: dto.consentVersion, idempotencyKey: dto.idempotencyKey, userId: a.userId }, requestMeta(req));
  }

  @Get('user/valuations')
  mine(@CurrentActor() a: AuthenticatedActor) {
    return this.valuation.mine(a.userId);
  }

  @Get('user/valuations/:id')
  getMine(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Query('t') t?: string) {
    return this.valuation.get(id, { userId: a.userId, token: t });
  }

  @Get('user/valuations/:id/evidence')
  evidenceMine(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Query('t') t?: string) {
    return this.valuation.evidence(id, { userId: a.userId, token: t });
  }

  @Get('user/valuations/:id/report')
  async reportMine(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response, @Query('t') t?: string) {
    sendPdf(res, await this.valuation.pdf(id, { userId: a.userId, token: t }));
  }

  @Post('user/valuations/:id/preview')
  previewMine(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PreviewDto, @Query('t') t?: string) {
    return this.valuation.preview(id, { userId: a.userId, token: t }, dto.financial ?? {}, dto.planned ?? []);
  }

  @Post('user/valuations/:id/verify')
  verify(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDto, @Req() req: Request, @Query('t') t?: string) {
    return this.valuation.createVerified(a.userId, id, t, dto, requestMeta(req));
  }

  @Post('user/valuations/:id/cancel')
  cancelMine(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Query('t') t?: string) {
    return this.valuation.cancel(id, { userId: a.userId, token: t });
  }

  // ── Super Admin ───────────────────────────────────────────────────────────
  @Get('admin/valuation/config')
  adminConfig(@CurrentActor() a: AuthenticatedActor) {
    return this.valuation.adminConfig(a.userId);
  }

  @Patch('admin/valuation/config')
  updateConfig(@CurrentActor() a: AuthenticatedActor, @Body() dto: ConfigDto, @Req() req: Request) {
    return this.valuation.updateConfig(a.userId, dto.config, dto.note, requestMeta(req));
  }

  @Post('admin/valuation/test')
  test(@CurrentActor() a: AuthenticatedActor, @Body() dto: TestDto) {
    return this.valuation.createTest(a.userId, dto.domain);
  }

  @Get('admin/valuation/history')
  history(@CurrentActor() a: AuthenticatedActor, @Query('kind') kind?: string, @Query('status') status?: string, @Query('domain') domain?: string) {
    return this.valuation.history(a.userId, { kind, status, domain });
  }

  @Get('admin/valuation/valuations/:id')
  detail(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.valuation.adminDetail(a.userId, id);
  }

  @Get('admin/valuation/sources')
  sources(@CurrentActor() a: AuthenticatedActor) {
    return this.valuation.sources(a.userId);
  }

  @Get('admin/valuation/usage')
  usage(@CurrentActor() a: AuthenticatedActor) {
    return this.valuation.usage(a.userId);
  }
}
