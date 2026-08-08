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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
let UploadService = class UploadService {
    configService;
    s3Client;
    bucketName;
    publicUrl;
    constructor(configService) {
        this.configService = configService;
        const accountId = this.configService.get('R2_ACCOUNT_ID');
        const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY');
        this.bucketName = this.configService.get('R2_BUCKET_NAME') || '';
        this.publicUrl = this.configService.get('R2_PUBLIC_URL') || '';
        if (!accountId ||
            !accessKeyId ||
            !secretAccessKey ||
            !this.bucketName ||
            !this.publicUrl) {
            console.warn('[UploadService] Warning: Cloudflare R2 credentials or configuration missing in environment.');
        }
        const endpoint = accountId && accountId.startsWith('http')
            ? accountId
            : `https://${accountId}.r2.cloudflarestorage.com`;
        this.s3Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
                accessKeyId: accessKeyId || 'placeholder',
                secretAccessKey: secretAccessKey || 'placeholder',
            },
            forcePathStyle: true,
        });
    }
    async getPresignedUploadUrl(fileName, contentType) {
        const accountId = this.configService.get('R2_ACCOUNT_ID');
        const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY');
        if (!accountId ||
            !accessKeyId ||
            !secretAccessKey ||
            !this.bucketName ||
            !this.publicUrl) {
            throw new common_1.BadRequestException('Cloudflare R2 storage integration is not properly configured on the server.');
        }
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
            throw new common_1.BadRequestException(`Invalid file extension. Allowed extensions are: ${allowedExtensions.join(', ')}`);
        }
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
        ];
        if (!allowedMimeTypes.includes(contentType)) {
            throw new common_1.BadRequestException(`Invalid content type. Allowed content types are: ${allowedMimeTypes.join(', ')}`);
        }
        const sanitizedName = fileName
            .replace(/[^a-zA-Z0-9.]/g, '_')
            .replace(/__+/g, '_');
        const key = `uploads/${(0, crypto_1.randomUUID)()}_${sanitizedName}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
        });
        try {
            const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, {
                expiresIn: 900,
            });
            const basePublicUrl = this.publicUrl.replace(/\/+$/, '');
            const fileUrl = `${basePublicUrl}/${key}`;
            return {
                uploadUrl,
                fileUrl,
                key,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Failed to generate upload signature: ${error.message}`);
        }
    }
    async uploadDirectFile(file) {
        const accountId = this.configService.get('R2_ACCOUNT_ID');
        const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY');
        if (!accountId ||
            !accessKeyId ||
            !secretAccessKey ||
            !this.bucketName ||
            !this.publicUrl) {
            throw new common_1.BadRequestException('Cloudflare R2 storage integration is not properly configured on the server.');
        }
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded.');
        }
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
            throw new common_1.BadRequestException(`Invalid file extension. Allowed extensions are: ${allowedExtensions.join(', ')}`);
        }
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException(`Invalid content type. Allowed content types are: ${allowedMimeTypes.join(', ')}`);
        }
        const sanitizedName = file.originalname
            .replace(/[^a-zA-Z0-9.]/g, '_')
            .replace(/__+/g, '_');
        const key = `uploads/${(0, crypto_1.randomUUID)()}_${sanitizedName}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        });
        try {
            await this.s3Client.send(command);
            const basePublicUrl = this.publicUrl.replace(/\/+$/, '');
            const fileUrl = `${basePublicUrl}/${key}`;
            return {
                fileUrl,
                key,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Failed to upload file: ${error.message}`);
        }
    }
    async uploadBuffer(buffer, mimetype, originalname) {
        const accountId = this.configService.get('R2_ACCOUNT_ID');
        const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY');
        if (!accountId ||
            !accessKeyId ||
            !secretAccessKey ||
            !this.bucketName ||
            !this.publicUrl) {
            throw new common_1.BadRequestException('Cloudflare R2 storage integration is not properly configured on the server.');
        }
        if (!buffer) {
            throw new common_1.BadRequestException('No buffer provided.');
        }
        const sanitizedName = originalname
            .replace(/[^a-zA-Z0-9.]/g, '_')
            .replace(/__+/g, '_');
        const key = `uploads/${(0, crypto_1.randomUUID)()}_${sanitizedName}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: mimetype,
        });
        try {
            await this.s3Client.send(command);
            const basePublicUrl = this.publicUrl.replace(/\/+$/, '');
            const fileUrl = `${basePublicUrl}/${key}`;
            return {
                fileUrl,
                key,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Failed to upload buffer: ${error.message}`);
        }
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadService);
//# sourceMappingURL=upload.service.js.map