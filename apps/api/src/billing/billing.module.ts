import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeClient } from './stripe.client';

@Module({
  controllers: [BillingController],
  providers: [StripeClient, BillingService],
  exports: [StripeClient, BillingService],
})
export class BillingModule {}
