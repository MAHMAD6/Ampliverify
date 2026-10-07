import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AuditsModule } from '../audits/audits.module';
import { OptimizationController } from './optimization.controller';
import { OptimizationService } from './optimization.service';

@Module({
  imports: [ProjectsModule, AuditsModule],
  controllers: [OptimizationController],
  providers: [OptimizationService],
})
export class OptimizationModule {}
