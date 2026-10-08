import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { BillingInterval, EntitlementValueType, PlanStatus } from '@prisma/client';
import { Request } from 'express';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { CommerceAdminService } from './commerce-admin.service';

class PlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

class PriceDto {
  @IsEnum(BillingInterval)
  billingInterval: BillingInterval;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsInt()
  @Min(0)
  amountMinor: number;
}

class EntitlementDto {
  @IsString()
  @MaxLength(100)
  featureKey: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limit?: number | null;

  @IsOptional()
  config?: unknown;
}

class EntitlementsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EntitlementDto)
  entitlements: EntitlementDto[];
}

class FeatureDto {
  @IsString()
  @MaxLength(100)
  key: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  moduleKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsEnum(EntitlementValueType)
  valueType: EntitlementValueType;
}

class OverrideDto {
  @IsString()
  @MaxLength(100)
  featureKey: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limit?: number | null;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

class AdjustmentDto {
  @IsUUID()
  workspaceId: string;

  @IsIn(['CREDIT', 'DEBIT', 'PROMOTIONAL_CREDIT', 'CORRECTION'])
  type: 'CREDIT' | 'DEBIT' | 'PROMOTIONAL_CREDIT' | 'CORRECTION';

  @IsNumber()
  amount: number;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  reasonCode: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  internalNote: string;
}

class ReviewDto {
  @IsBoolean()
  approve: boolean;
}

class ReverseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  note: string;
}

@Controller('admin')
export class CommerceAdminController {
  constructor(private readonly commerce: CommerceAdminService) {}

  @Get('plans')
  plans(@CurrentActor() actor: AuthenticatedActor) {
    return this.commerce.listPlans(actor.userId);
  }

  @Post('plans')
  createPlan(@CurrentActor() actor: AuthenticatedActor, @Body() dto: PlanDto, @Req() req: Request) {
    return this.commerce.createPlan(actor.userId, dto, requestMeta(req));
  }

  @Get('plans/:code')
  plan(@CurrentActor() actor: AuthenticatedActor, @Param('code') code: string) {
    return this.commerce.getPlan(actor.userId, code);
  }

  @Patch('plans/:code')
  updatePlan(@CurrentActor() actor: AuthenticatedActor, @Param('code') code: string, @Body() dto: PlanDto, @Req() req: Request) {
    return this.commerce.updatePlan(actor.userId, code, dto, requestMeta(req));
  }

  @Post('plans/:code/prices')
  addPrice(@CurrentActor() actor: AuthenticatedActor, @Param('code') code: string, @Body() dto: PriceDto, @Req() req: Request) {
    return this.commerce.addPrice(actor.userId, code, dto, requestMeta(req));
  }

  @Put('plans/:code/entitlements')
  setEntitlements(@CurrentActor() actor: AuthenticatedActor, @Param('code') code: string, @Body() dto: EntitlementsDto, @Req() req: Request) {
    return this.commerce.setEntitlements(actor.userId, code, dto.entitlements, requestMeta(req));
  }

  @Get('features')
  features(@CurrentActor() actor: AuthenticatedActor) {
    return this.commerce.listFeatures(actor.userId);
  }

  @Post('features')
  createFeature(@CurrentActor() actor: AuthenticatedActor, @Body() dto: FeatureDto, @Req() req: Request) {
    return this.commerce.createFeature(actor.userId, dto, requestMeta(req));
  }

  @Get('entitlement-overrides')
  overrides(@CurrentActor() actor: AuthenticatedActor, @Query('workspaceId') workspaceId?: string) {
    return this.commerce.listOverrides(actor.userId, workspaceId);
  }

  @Post('workspaces/:id/entitlement-overrides')
  addOverride(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OverrideDto, @Req() req: Request) {
    return this.commerce.addOverride(actor.userId, id, dto, requestMeta(req));
  }

  @Get('subscriptions')
  subscriptions(@CurrentActor() actor: AuthenticatedActor, @Query('status') status?: string) {
    return this.commerce.listSubscriptions(actor.userId, status);
  }

  @Get('subscriptions/:id')
  subscription(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.commerce.getSubscription(actor.userId, id);
  }

  @Get('invoices')
  invoices(@CurrentActor() actor: AuthenticatedActor, @Query('status') status?: string) {
    return this.commerce.listInvoices(actor.userId, status);
  }

  @Get('invoices/:id')
  invoice(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.commerce.getInvoice(actor.userId, id);
  }

  @Get('credit-adjustments')
  adjustments(@CurrentActor() actor: AuthenticatedActor, @Query('status') status?: string) {
    return this.commerce.listAdjustments(actor.userId, status);
  }

  @Post('credit-adjustments')
  requestAdjustment(@CurrentActor() actor: AuthenticatedActor, @Body() dto: AdjustmentDto, @Req() req: Request) {
    return this.commerce.requestAdjustment(actor.userId, dto, requestMeta(req));
  }

  @Post('credit-adjustments/:id/review')
  review(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto, @Req() req: Request) {
    return this.commerce.reviewAdjustment(actor.userId, id, dto.approve, requestMeta(req));
  }

  @Post('credit-adjustments/:id/reverse')
  reverse(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReverseDto, @Req() req: Request) {
    return this.commerce.reverseAdjustment(actor.userId, id, dto.note, requestMeta(req));
  }
}
