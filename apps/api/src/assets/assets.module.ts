import { Module } from '@nestjs/common';
import { ValuationModule } from '../valuation/valuation.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [ValuationModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
