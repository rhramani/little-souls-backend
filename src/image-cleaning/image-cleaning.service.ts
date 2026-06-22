import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { WebhookCallbackDto } from './dto/webhook-callback.dto';
import { ConfigService } from '@nestjs/config';
import { UploadService } from '../upload/upload.service';
import axios from 'axios';

@Injectable()
export class ImageCleaningService {
  private readonly logger = new Logger(ImageCleaningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
  ) {}

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
        provider: 'PHOTOROOM',
        originalUrl: image.originalUrl,
        status: 'PENDING',
        createdBy: userId,
      },
    });

    await this.prisma.productImage.update({
      where: { id: image.id },
      data: { cleaningStatus: 'PROCESSING' },
    });

    // Start background processing
    this.processTaskInBackground(task.id, userId).catch((err) => {
      this.logger.error(
        `[ImageCleaning] Background processing initiation failed: ${err.message}`,
      );
    });

    return {
      message: 'Image cleaning task submitted successfully.',
      taskId: task.id,
    };
  }

  async triggerBackgroundCleaningForProduct(
    productId: string,
    userId?: string,
  ) {
    const images = await this.prisma.productImage.findMany({
      where: {
        productId,
        cleaningStatus: { in: ['NOT_REQUIRED', 'FAILED'] },
      },
    });

    for (const image of images) {
      this.autoCleanImage(image.id, userId).catch((err) => {
        this.logger.error(
          `[ImageCleaning] Auto-clean trigger failed for image ${image.id}: ${err.message}`,
        );
      });
    }
  }

  async triggerBackgroundCleaningForCatalogue(
    catalogueId: string,
    userId?: string,
  ) {
    const images = await this.prisma.productImage.findMany({
      where: {
        product: { catalogueId },
        cleaningStatus: { in: ['NOT_REQUIRED', 'FAILED'] },
      },
    });

    for (const image of images) {
      this.autoCleanImage(image.id, userId).catch((err) => {
        this.logger.error(
          `[ImageCleaning] Auto-clean trigger failed for image ${image.id}: ${err.message}`,
        );
      });
    }
  }

  async autoCleanImage(productImageId: string, userId?: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: productImageId },
    });

    if (!image || image.cleaningStatus === 'PROCESSING') {
      return;
    }

    const task = await this.prisma.imageCleaningTask.create({
      data: {
        productImageId: image.id,
        productId: image.productId,
        provider: 'PHOTOROOM',
        originalUrl: image.originalUrl,
        status: 'PENDING',
        createdBy: userId || null,
      },
    });

    await this.prisma.productImage.update({
      where: { id: image.id },
      data: { cleaningStatus: 'PROCESSING' },
    });

    await this.processTaskInBackground(task.id, userId);
  }

  async processTaskInBackground(taskId: string, userId?: string) {
    const task = await this.prisma.imageCleaningTask.findUnique({
      where: { id: taskId },
    });

    if (!task) return;

    const apiKey = this.configService.get<string>('IMAGE_CLEANING_API_KEY');
    const isApiKeyValid =
      apiKey &&
      apiKey.trim().length > 0 &&
      !apiKey.toLowerCase().includes('dummy') &&
      !apiKey.toLowerCase().includes('your_api_key');

    if (isApiKeyValid) {
      try {
        this.logger.log(
          `[ImageCleaning] Processing task ${taskId} using real Photoroom API...`,
        );

        // Fetch edited/enhanced image directly from Photoroom API v2
        const photoroomUrl = `https://image-api.photoroom.com/v2/edit?imageUrl=${encodeURIComponent(
          task.originalUrl,
        )}&removeBackground=true`;

        const response = await axios.get(photoroomUrl, {
          headers: {
            'x-api-key': apiKey,
          },
          responseType: 'arraybuffer',
          timeout: 20000,
        });

        const buffer = Buffer.from(response.data);

        // Upload the binary response back to our Cloudflare R2 storage
        const uploadResult = await this.uploadService.uploadBuffer(
          buffer,
          'image/png',
          `cleaned_${task.id}.png`,
        );

        // Update task and image sequentially (no transaction) to prevent write conflicts
        await this.prisma.imageCleaningTask.update({
          where: { id: taskId },
          data: { status: 'COMPLETED', cleanedUrl: uploadResult.fileUrl },
        });
        await this.prisma.productImage.update({
          where: { id: task.productImageId },
          data: {
            cleanedUrl: uploadResult.fileUrl,
            cleaningStatus: 'COMPLETED',
          },
        });

        this.logger.log(
          `[ImageCleaning] Task ${taskId} completed successfully. Cleaned URL: ${uploadResult.fileUrl}`,
        );
      } catch (error: any) {
        this.logger.error(
          `[ImageCleaning] Real Photoroom API call failed for task ${taskId}: ${error.message}`,
        );

        const errorMsg = error.response
          ? `Photoroom API Error (${error.response.status}): ${
              error.response.data?.toString() || error.message
            }`
          : error.message;

        await this.prisma.imageCleaningTask.update({
          where: { id: taskId },
          data: { status: 'FAILED', errorMessage: errorMsg },
        });
        await this.prisma.productImage.update({
          where: { id: task.productImageId },
          data: { cleaningStatus: 'FAILED' },
        });
      }
    } else {
      // Mock background processing with 2s delay
      this.logger.log(
        `[ImageCleaning] IMAGE_CLEANING_API_KEY not configured. Simulating mock image cleaning for task ${taskId}...`,
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockCleanedUrl = `https://placehold.co/600x600?text=Mock+Cleaned+Image+${task.id}`;

      await this.prisma.imageCleaningTask.update({
        where: { id: taskId },
        data: { status: 'COMPLETED', cleanedUrl: mockCleanedUrl },
      });
      await this.prisma.productImage.update({
        where: { id: task.productImageId },
        data: {
          cleanedUrl: mockCleanedUrl,
          cleaningStatus: 'COMPLETED',
        },
      });

      this.logger.log(`[ImageCleaning] Mock task ${taskId} completed.`);
    }
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
