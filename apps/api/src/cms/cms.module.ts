import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { CareersService } from './careers.service';

@Module({
  controllers: [CmsController],
  providers: [CmsService, CareersService],
})
export class CmsModule {}
