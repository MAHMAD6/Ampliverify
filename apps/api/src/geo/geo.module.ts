import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { ProjectsModule } from '../projects/projects.module';
import { GeoController } from './geo.controller';
import { GeoProviders } from './geo-providers';
import { GeoService } from './geo.service';

@Module({
  imports: [ProjectsModule, KeywordsModule],
  controllers: [GeoController],
  providers: [GeoProviders, GeoService],
  exports: [GeoService, GeoProviders],
})
export class GeoModule {}
