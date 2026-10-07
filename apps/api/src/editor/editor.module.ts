import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { EditorController } from './editor.controller';
import { EditorService } from './editor.service';

@Module({
  imports: [ProjectsModule],
  controllers: [EditorController],
  providers: [EditorService],
  exports: [EditorService],
})
export class EditorModule {}
