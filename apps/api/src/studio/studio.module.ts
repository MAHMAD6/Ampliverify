import { Module } from '@nestjs/common';
import { StudioController, StudioPublicController } from './studio.controller';
import { StudioMediaService } from './studio-media.service';
import { StudioService } from './studio.service';

/** SEO Editor Studio: the V13 editor's NestJS services merged into the AmpliVerify API. */
@Module({
  controllers: [StudioController, StudioPublicController],
  providers: [StudioService, StudioMediaService],
  exports: [StudioService, StudioMediaService],
})
export class StudioModule {}
