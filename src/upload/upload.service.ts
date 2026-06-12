import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || '';

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !this.bucketName ||
      !this.publicUrl
    ) {
      // Don't throw inside constructor to avoid Nest boot failure in dev, but log warning or throw inside runtime methods
      console.warn(
        '[UploadService] Warning: Cloudflare R2 credentials or configuration missing in environment.',
      );
    }

    const endpoint =
      accountId && accountId.startsWith('http')
        ? accountId
        : `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId || 'placeholder',
        secretAccessKey: secretAccessKey || 'placeholder',
      },
      forcePathStyle: true,
    });
  }

  async getPresignedUploadUrl(fileName: string, contentType: string) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !this.bucketName ||
      !this.publicUrl
    ) {
      throw new BadRequestException(
        'Cloudflare R2 storage integration is not properly configured on the server.',
      );
    }

    // 1. Validate file extension/type
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed extensions are: ${allowedExtensions.join(', ')}`,
      );
    }

    // 2. Validate MIME type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(contentType)) {
      throw new BadRequestException(
        `Invalid content type. Allowed content types are: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // 3. Generate a unique key/path for the file in the bucket
    const sanitizedName = fileName
      .replace(/[^a-zA-Z0-9.]/g, '_')
      .replace(/__+/g, '_');
    const key = `uploads/${randomUUID()}_${sanitizedName}`;

    // 4. Generate the presigned URL for PUT request
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    try {
      // Link expires in 15 minutes (900 seconds)
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 900,
      });

      // Build the final public URL for file download/viewing
      // Ensure there are no trailing/leading slashes mismatch
      const basePublicUrl = this.publicUrl.replace(/\/+$/, '');
      const fileUrl = `${basePublicUrl}/${key}`;

      return {
        uploadUrl,
        fileUrl,
        key,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to generate upload signature: ${error.message}`,
      );
    }
  }

  async uploadDirectFile(file: Express.Multer.File) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !this.bucketName ||
      !this.publicUrl
    ) {
      throw new BadRequestException(
        'Cloudflare R2 storage integration is not properly configured on the server.',
      );
    }

    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    // 1. Validate file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed extensions are: ${allowedExtensions.join(', ')}`,
      );
    }

    // 2. Validate MIME type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid content type. Allowed content types are: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // 3. Generate a unique key/path for the file in the bucket
    const sanitizedName = file.originalname
      .replace(/[^a-zA-Z0-9.]/g, '_')
      .replace(/__+/g, '_');
    const key = `uploads/${randomUUID()}_${sanitizedName}`;

    // 4. Upload the buffer directly to R2
    const command = new PutObjectCommand({
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
    } catch (error: any) {
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  async uploadBuffer(buffer: Buffer, mimetype: string, originalname: string) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !this.bucketName ||
      !this.publicUrl
    ) {
      throw new BadRequestException(
        'Cloudflare R2 storage integration is not properly configured on the server.',
      );
    }

    if (!buffer) {
      throw new BadRequestException('No buffer provided.');
    }

    // 1. Generate a unique key/path for the file in the bucket
    const sanitizedName = originalname
      .replace(/[^a-zA-Z0-9.]/g, '_')
      .replace(/__+/g, '_');
    const key = `uploads/${randomUUID()}_${sanitizedName}`;

    // 2. Upload the buffer directly to R2
    const command = new PutObjectCommand({
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
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to upload buffer: ${error.message}`,
      );
    }
  }
}
