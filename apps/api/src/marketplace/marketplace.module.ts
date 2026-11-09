import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CommerceService } from './commerce.service';
import { DealsService } from './deals.service';
import { MarketplaceAdminController, MarketplaceController, MarketplacePublicController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [BillingModule],
  controllers: [MarketplacePublicController, MarketplaceController, MarketplaceAdminController],
  providers: [MarketplaceService, DealsService, CommerceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
