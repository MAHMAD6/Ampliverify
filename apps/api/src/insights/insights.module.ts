import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AuditsModule } from '../audits/audits.module';
import { GeoModule } from '../geo/geo.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
  imports: [ProjectsModule, AuditsModule, GeoModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
