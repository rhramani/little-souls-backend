import { ImageCleaningService } from './image-cleaning.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { WebhookCallbackDto } from './dto/webhook-callback.dto';
export declare class ImageCleaningController {
    private readonly imageCleaningService;
    constructor(imageCleaningService: ImageCleaningService);
    submitTask(dto: SubmitTaskDto, userId: string): Promise<{
        message: string;
        taskId: string;
    }>;
    handleWebhook(dto: WebhookCallbackDto): Promise<{
        received: boolean;
    }>;
}
