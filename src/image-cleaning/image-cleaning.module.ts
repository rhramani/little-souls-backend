import { Module } from '@nestjs/common';
import { ImageCleaningService } from './image-cleaning.service';
import { ImageCleaningController } from './image-cleaning.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  providers: [ImageCleaningService],
  controllers: [ImageCleaningController],
  exports: [ImageCleaningService],
})
export class ImageCleaningModule {}
