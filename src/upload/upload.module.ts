import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { PublicUploadController } from './public-upload.controller';

@Module({
  imports: [ConfigModule],
  controllers: [UploadController, PublicUploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
