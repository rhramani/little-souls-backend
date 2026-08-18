"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ImageCleaningService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageCleaningService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const upload_service_1 = require("../upload/upload.service");
const axios_1 = __importDefault(require("axios"));
let ImageCleaningService = ImageCleaningService_1 = class ImageCleaningService {
    prisma;
    configService;
    uploadService;
    logger = new common_1.Logger(ImageCleaningService_1.name);
    constructor(prisma, configService, uploadService) {
        this.prisma = prisma;
        this.configService = configService;
        this.uploadService = uploadService;
    }
    async submitTask(dto, userId) {
        const image = await this.prisma.productImage.findUnique({
            where: { id: dto.productImageId },
        });
        if (!image) {
            throw new common_1.NotFoundException('Product Image not found.');
        }
        if (image.cleaningStatus === 'PROCESSING') {
            throw new common_1.BadRequestException('Image is already being cleaned.');
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
        this.processTaskInBackground(task.id, userId).catch((err) => {
            this.logger.error(`[ImageCleaning] Background processing initiation failed: ${err.message}`);
        });
        return {
            message: 'Image cleaning task submitted successfully.',
            taskId: task.id,
        };
    }
    async triggerBackgroundCleaningForProduct(productId, userId) {
        return;
    }
    async triggerBackgroundCleaningForCatalogue(catalogueId, userId) {
        return;
    }
    async autoCleanImage(productImageId, userId) {
        return;
    }
    async processTaskInBackground(taskId, userId) {
        const task = await this.prisma.imageCleaningTask.findUnique({
            where: { id: taskId },
        });
        if (!task)
            return;
        const apiKey = this.configService.get('IMAGE_CLEANING_API_KEY');
        const isApiKeyValid = apiKey &&
            apiKey.trim().length > 0 &&
            !apiKey.toLowerCase().includes('dummy') &&
            !apiKey.toLowerCase().includes('your_api_key');
        if (isApiKeyValid) {
            try {
                this.logger.log(`[ImageCleaning] Processing task ${taskId} using real Photoroom API...`);
                const photoroomUrl = `https://image-api.photoroom.com/v2/edit?imageUrl=${encodeURIComponent(task.originalUrl)}&removeBackground=true`;
                const response = await axios_1.default.get(photoroomUrl, {
                    headers: {
                        'x-api-key': apiKey,
                    },
                    responseType: 'arraybuffer',
                    timeout: 20000,
                });
                const buffer = Buffer.from(response.data);
                const uploadResult = await this.uploadService.uploadBuffer(buffer, 'image/png', `cleaned_${task.id}.png`);
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
                this.logger.log(`[ImageCleaning] Task ${taskId} completed successfully. Cleaned URL: ${uploadResult.fileUrl}`);
            }
            catch (error) {
                this.logger.error(`[ImageCleaning] Real Photoroom API call failed for task ${taskId}: ${error.message}`);
                const errorMsg = error.response
                    ? `Photoroom API Error (${error.response.status}): ${error.response.data?.toString() || error.message}`
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
        }
        else {
            this.logger.log(`[ImageCleaning] IMAGE_CLEANING_API_KEY not configured. Simulating mock image cleaning for task ${taskId}...`);
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
    async handleWebhook(dto) {
        const task = await this.prisma.imageCleaningTask.findUnique({
            where: { id: dto.taskId },
        });
        if (!task) {
            throw new common_1.NotFoundException('Task not found.');
        }
        if (dto.status === 'COMPLETED' && dto.cleanedUrl) {
            await Promise.all([
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
        }
        else {
            await Promise.all([
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
};
exports.ImageCleaningService = ImageCleaningService;
exports.ImageCleaningService = ImageCleaningService = ImageCleaningService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        upload_service_1.UploadService])
], ImageCleaningService);
//# sourceMappingURL=image-cleaning.service.js.map