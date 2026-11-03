import { Module } from '@nestjs/common';
import { MarketplaceAdminController, MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  controllers: [MarketplaceController, MarketplaceAdminController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}
