import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class UpdateCatalogueDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
