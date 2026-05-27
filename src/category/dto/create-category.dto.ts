import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { IsR2Url } from '../../upload/decorators/is-r2-url.decorator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID('4', { message: 'Parent Category ID must be a valid UUID' })
  @IsOptional()
  parentCategoryId?: string;

  @IsString()
  @IsOptional()
  @IsR2Url()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  @IsR2Url()
  bannerUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
