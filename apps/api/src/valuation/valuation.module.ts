import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ValuationController } from './valuation.controller';
import { ValuationService } from './valuation.service';

@Module({
  imports: [KeywordsModule, IntegrationsModule],
  controllers: [ValuationController],
  providers: [ValuationService],
})
export class ValuationModule {}
