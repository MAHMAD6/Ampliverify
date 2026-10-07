import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedActor } from '../common/types/actor.type';
import { requestMeta } from '../common/types/request-meta.type';
import { BillingService } from './billing.service';

class SubscriptionCheckoutDto {
  @IsString()
  @MaxLength(64)
  planCode: string;

  @IsIn(['MONTHLY', 'ANNUAL'])
  interval: 'MONTHLY' | 'ANNUAL';
}

class CreditCheckoutDto {
  @IsString()
  @MaxLength(64)
  packCode: string;
}

class CancelDto {
  @IsBoolean()
  cancel: boolean;
}

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('user/workspaces/:workspaceId/billing')
  overview(@CurrentActor() actor: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.billing.overview(actor.userId, workspaceId);
  }

  @Get('user/workspaces/:workspaceId/invoices')
  invoices(@CurrentActor() actor: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.billing.invoices(actor.userId, workspaceId);
  }

  @Get('user/workspaces/:workspaceId/credits/ledger')
  ledger(@CurrentActor() actor: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Query('limit') limit?: string) {
    return this.billing.ledger(actor.userId, workspaceId, limit ? Number(limit) : undefined);
  }

  @Get('user/workspaces/:workspaceId/usage')
  usage(@CurrentActor() actor: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Query('days') days?: string) {
    return this.billing.usageHistory(actor.userId, workspaceId, days ? Number(days) : undefined);
  }

  @Post('user/workspaces/:workspaceId/billing/checkout')
  checkout(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: SubscriptionCheckoutDto,
    @Req() req: Request,
  ) {
    return this.billing.checkoutSubscription(actor.userId, workspaceId, dto.planCode, dto.interval, requestMeta(req));
  }

  @Post('user/workspaces/:workspaceId/credits/checkout')
  buyCredits(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreditCheckoutDto,
    @Req() req: Request,
  ) {
    return this.billing.checkoutCredits(actor.userId, workspaceId, dto.packCode, requestMeta(req));
  }

  @Post('user/workspaces/:workspaceId/billing/portal')
  portal(@CurrentActor() actor: AuthenticatedActor, @Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.billing.portal(actor.userId, workspaceId);
  }

  @Post('user/workspaces/:workspaceId/billing/cancel')
  cancel(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CancelDto,
    @Req() req: Request,
  ) {
    return this.billing.setCancelAtPeriodEnd(actor.userId, workspaceId, dto.cancel, requestMeta(req));
  }

  /** Stripe webhook: signature-verified, stored, processed asynchronously. */
  @Public()
  @Post('webhooks/stripe')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.billing.receiveWebhook(req.rawBody, signature);
  }
}
