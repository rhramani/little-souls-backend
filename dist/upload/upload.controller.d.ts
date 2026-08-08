import { UploadService } from './upload.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
export declare class UploadController {
    private readonly uploadService;
    constructor(uploadService: UploadService);
    generatePresignedUrl(dto: PresignUploadDto): Promise<{
        uploadUrl: string;
        fileUrl: string;
        key: string;
    }>;
    uploadFile(file: Express.Multer.File): Promise<{
        fileUrl: string;
        key: string;
    }>;
}
