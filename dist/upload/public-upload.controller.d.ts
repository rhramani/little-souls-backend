import { UploadService } from './upload.service';
export declare class PublicUploadController {
    private readonly uploadService;
    constructor(uploadService: UploadService);
    uploadFile(file: Express.Multer.File): Promise<{
        fileUrl: string;
        key: string;
    }>;
}
