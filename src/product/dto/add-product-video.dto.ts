import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddProductVideoDto {
  @IsNotEmpty()
  @IsString()
  videoUrl: string;

  @IsNotEmpty()
  @IsString()
  videoType: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
