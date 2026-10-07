import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { DataForSeoClient } from './dataforseo.client';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';

@Module({
  imports: [ProjectsModule],
  controllers: [KeywordsController],
  providers: [DataForSeoClient, KeywordsService],
  exports: [KeywordsService],
})
export class KeywordsModule {}
