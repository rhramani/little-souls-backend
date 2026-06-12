import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { WebhookCallbackDto } from './dto/webhook-callback.dto';

@Injectable()
export class ImageCleaningService {
  constructor(private readonly prisma: PrismaService) {}

  async submitTask(dto: SubmitTaskDto, userId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: dto.productImageId },
    });

    if (!image) {
      throw new NotFoundException('Product Image not found.');
    }

    if (image.cleaningStatus === 'PROCESSING') {
      throw new BadRequestException('Image is already being cleaned.');
    }

    const task = await this.prisma.imageCleaningTask.create({
      data: {
        productImageId: image.id,
        productId: image.productId,
        provider: 'PHOTOROOM_MOCK',
        originalUrl: image.originalUrl,
        status: 'PENDING',
        createdBy: userId,
      },
    });

    await this.prisma.productImage.update({
      where: { id: image.id },
      data: { cleaningStatus: 'PROCESSING' },
    });

    // Mock API request to 3rd party
    console.log(`[ImageCleaning] Submitted task ${task.id} to Photoroom API`);

    return {
      message: 'Image cleaning task submitted successfully.',
      taskId: task.id,
    };
  }

  async handleWebhook(dto: WebhookCallbackDto) {
    const task = await this.prisma.imageCleaningTask.findUnique({
      where: { id: dto.taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (dto.status === 'COMPLETED' && dto.cleanedUrl) {
      await this.prisma.$transaction([
        this.prisma.imageCleaningTask.update({
          where: { id: dto.taskId },
          data: { status: 'COMPLETED', cleanedUrl: dto.cleanedUrl },
        }),
        this.prisma.productImage.update({
          where: { id: task.productImageId },
          data: {
            cleanedUrl: dto.cleanedUrl,
            cleaningStatus: 'COMPLETED',
          },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.imageCleaningTask.update({
          where: { id: dto.taskId },
          data: { status: 'FAILED', errorMessage: dto.errorMessage },
        }),
        this.prisma.productImage.update({
          where: { id: task.productImageId },
          data: {
            cleaningStatus: 'FAILED',
          },
        }),
      ]);
    }

    return { received: true };
  }
}
