import { IsString, IsNotEmpty } from 'class-validator';

export class PresignUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;
}
