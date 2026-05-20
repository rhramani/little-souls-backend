import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ImageCleaningService } from './image-cleaning.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { WebhookCallbackDto } from './dto/webhook-callback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('image-cleaning')
export class ImageCleaningController {
  constructor(private readonly imageCleaningService: ImageCleaningService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async submitTask(@Body() dto: SubmitTaskDto, @GetUser('id') userId: string) {
    return this.imageCleaningService.submitTask(dto, userId);
  }

  // Webhook is public (in a real scenario, protect it with a signature check)
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() dto: WebhookCallbackDto) {
    return this.imageCleaningService.handleWebhook(dto);
  }
}
