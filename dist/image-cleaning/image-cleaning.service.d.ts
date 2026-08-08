import { PrismaService } from '../prisma/prisma.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { WebhookCallbackDto } from './dto/webhook-callback.dto';
import { ConfigService } from '@nestjs/config';
import { UploadService } from '../upload/upload.service';
export declare class ImageCleaningService {
    private readonly prisma;
    private readonly configService;
    private readonly uploadService;
    private readonly logger;
    constructor(prisma: PrismaService, configService: ConfigService, uploadService: UploadService);
    submitTask(dto: SubmitTaskDto, userId: string): Promise<{
        message: string;
        taskId: string;
    }>;
    triggerBackgroundCleaningForProduct(productId: string, userId?: string): Promise<void>;
    triggerBackgroundCleaningForCatalogue(catalogueId: string, userId?: string): Promise<void>;
    autoCleanImage(productImageId: string, userId?: string): Promise<void>;
    processTaskInBackground(taskId: string, userId?: string): Promise<void>;
    handleWebhook(dto: WebhookCallbackDto): Promise<{
        received: boolean;
    }>;
}
