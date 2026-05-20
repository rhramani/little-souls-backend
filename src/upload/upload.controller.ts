import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadService } from './upload.service';
import { PresignUploadDto } from './dto/presign-upload.dto';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  async generatePresignedUrl(@Body() dto: PresignUploadDto) {
    return this.uploadService.getPresignedUploadUrl(dto.fileName, dto.contentType);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadDirectFile(file);
  }
}
