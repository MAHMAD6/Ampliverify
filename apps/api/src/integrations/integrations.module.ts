import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { EditorModule } from '../editor/editor.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [ProjectsModule, EditorModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
