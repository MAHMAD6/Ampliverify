import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { OptimizationModule } from '../optimization/optimization.module';
import { GeoModule } from '../geo/geo.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ProjectsModule, OptimizationModule, GeoModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
