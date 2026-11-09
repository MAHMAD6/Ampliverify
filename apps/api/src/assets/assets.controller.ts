import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AssetRelationship, MarketplaceAssetType } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { ANALYSIS_CHECKS, AssetsService } from './assets.service';

const MAX_MINOR = 100_000_000_000;

class AssetDto {
  @IsUUID() workspaceId: string;
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(300) url?: string | null;
  @IsEnum(MarketplaceAssetType) assetType: MarketplaceAssetType;
  @IsEnum(AssetRelationship) relationship: AssetRelationship;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(60) category?: string | null;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) acquiredAt?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MINOR) purchasePriceMinor?: number | null;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsUUID() projectId?: string | null;
}

class UpdateAssetDto {
  @IsOptional() @IsBoolean() archived?: boolean;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(300) url?: string | null;
  @IsOptional() @IsEnum(MarketplaceAssetType) assetType?: MarketplaceAssetType;
  @IsOptional() @IsEnum(AssetRelationship) relationship?: AssetRelationship;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(60) category?: string | null;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) acquiredAt?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MINOR) purchasePriceMinor?: number | null;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsUUID() projectId?: string | null;
}

class VerifyDto {
  @IsIn(['DNS_TXT', 'META_TAG', 'HTML_FILE']) method: 'DNS_TXT' | 'META_TAG' | 'HTML_FILE';
}

class FinancialDto {
  @Matches(/^\d{4}-\d{2}$/) month: string;
  @IsInt() @Min(0) @Max(MAX_MINOR) revenueMinor: number;
  @IsInt() @Min(0) @Max(MAX_MINOR) costMinor: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class AnalyzeDto {
  @IsUUID() workspaceId: string;
  @IsString() @MaxLength(300) url: string;
  @IsEnum(MarketplaceAssetType) assetType: MarketplaceAssetType;
  @IsArray() @ArrayMaxSize(10) @IsIn(ANALYSIS_CHECKS as unknown as string[], { each: true }) checks: string[];
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MINOR) askingPriceMinor?: number | null;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

@Controller('user/assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('summary')
  summary(@CurrentActor() a: AuthenticatedActor, @Query('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.assets.summary(a.userId, workspaceId);
  }

  @Get()
  list(@CurrentActor() a: AuthenticatedActor, @Query('workspaceId', ParseUUIDPipe) workspaceId: string, @Query('relationship') relationship?: string, @Query('q') q?: string, @Query('archived') archived?: string) {
    return this.assets.list(a.userId, workspaceId, { relationship: relationship && relationship in AssetRelationship ? (relationship as AssetRelationship) : undefined, q: q?.slice(0, 120), archived: archived === '1' });
  }

  @Get('performance')
  performance(@CurrentActor() a: AuthenticatedActor, @Query('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.assets.performance(a.userId, workspaceId);
  }

  @Get('acquisitions')
  analyses(@CurrentActor() a: AuthenticatedActor, @Query('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.assets.analyses(a.userId, workspaceId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('acquisitions')
  analyze(@CurrentActor() a: AuthenticatedActor, @Body() dto: AnalyzeDto) {
    return this.assets.analyze(a.userId, dto);
  }

  @Get('acquisitions/:id')
  analysis(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.analysis(a.userId, id);
  }

  @Post('acquisitions/:id/save')
  saveProspect(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.saveProspect(a.userId, id);
  }

  @Post()
  create(@CurrentActor() a: AuthenticatedActor, @Body() dto: AssetDto) {
    return this.assets.create(a.userId, dto);
  }

  @Get(':id')
  detail(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.detail(a.userId, id);
  }

  @Patch(':id')
  update(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto) {
    return this.assets.update(a.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.remove(a.userId, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/verify')
  verify(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDto) {
    return this.assets.verify(a.userId, id, dto.method);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  evidence(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body('note') note: string | undefined, @UploadedFile() file: { buffer: Buffer; originalname: string; size: number }) {
    return this.assets.uploadEvidence(a.userId, id, note, file);
  }

  @Post(':id/financials')
  addFinancial(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FinancialDto) {
    return this.assets.addFinancial(a.userId, id, dto);
  }

  @Delete(':id/financials/:entryId')
  deleteFinancial(@CurrentActor() a: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.assets.deleteFinancial(a.userId, id, entryId);
  }
}
