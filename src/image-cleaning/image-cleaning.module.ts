import { Module } from '@nestjs/common';
import { ImageCleaningService } from './image-cleaning.service';
import { ImageCleaningController } from './image-cleaning.controller';

@Module({
  providers: [ImageCleaningService],
  controllers: [ImageCleaningController]
})
export class ImageCleaningModule {}
