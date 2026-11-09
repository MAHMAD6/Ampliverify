import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeClient } from './stripe.client';
import { StripeEventHooks } from './stripe-event-hooks';

@Module({
  controllers: [BillingController],
  providers: [StripeClient, StripeEventHooks, BillingService],
  exports: [StripeClient, StripeEventHooks, BillingService],
})
export class BillingModule {}
