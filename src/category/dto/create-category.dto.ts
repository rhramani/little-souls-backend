import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
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

  @IsMongoId({ message: 'Parent Category ID must be a valid Mongo ID' })
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

  @IsMongoId({ message: 'Catalogue ID must be a valid Mongo ID' })
  @IsOptional()
  catalogueId?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
