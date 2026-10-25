import { Module } from '@nestjs/common';
import { EditorModule } from '../editor/editor.module';
import { ProjectsModule } from '../projects/projects.module';
import { AiAssistService } from './ai-assist.service';
import { ContentAiController } from './content-ai.controller';
import { ContentAuditService } from './content-audit.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [ProjectsModule, EditorModule],
  controllers: [ContentController, ContentAiController],
  providers: [ContentService, ContentAuditService, AiAssistService],
  exports: [ContentService],
})
export class ContentModule {}
