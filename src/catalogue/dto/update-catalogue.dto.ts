import { IsString, IsOptional, IsBoolean } from 'class-validator';

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
}
