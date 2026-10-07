import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [ProjectsModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
