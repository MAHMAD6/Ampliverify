import { Global, Module } from '@nestjs/common';
import { ContentStorageService } from './content-storage.service';

@Global()
@Module({
  providers: [ContentStorageService],
  exports: [ContentStorageService],
})
export class StorageModule {}
