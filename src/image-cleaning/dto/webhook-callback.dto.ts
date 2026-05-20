import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class WebhookCallbackDto {
  @IsNotEmpty()
  @IsString()
  taskId: string;

  @IsNotEmpty()
  @IsString()
  status: string; // 'COMPLETED' | 'FAILED'

  @IsOptional()
  @IsString()
  cleanedUrl?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
