import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AuditsModule } from '../audits/audits.module';
import { OptimizationController } from './optimization.controller';
import { OptimizationService } from './optimization.service';
import { ActionPlanService } from './action-plan.service';

@Module({
  imports: [ProjectsModule, AuditsModule],
  controllers: [OptimizationController],
  providers: [OptimizationService, ActionPlanService],
  exports: [OptimizationService],
})
export class OptimizationModule {}
