import { ConfigService } from '@nestjs/config';
export declare class UploadService {
    private configService;
    private s3Client;
    private bucketName;
    private publicUrl;
    constructor(configService: ConfigService);
    getPresignedUploadUrl(fileName: string, contentType: string): Promise<{
        uploadUrl: string;
        fileUrl: string;
        key: string;
    }>;
    uploadDirectFile(file: Express.Multer.File): Promise<{
        fileUrl: string;
        key: string;
    }>;
    uploadBuffer(buffer: Buffer, mimetype: string, originalname: string): Promise<{
        fileUrl: string;
        key: string;
    }>;
}
