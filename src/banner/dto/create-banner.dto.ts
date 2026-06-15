import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsIn(['HERO', 'CATEGORY', 'PROMO', 'WEB_HEADER', 'MOBILE'])
  bannerType: string;

  @IsString()
  imageUrl: string;

  @IsIn(['CATEGORY', 'PRODUCT', 'CUSTOM', 'NONE'])
  linkType: string;

  @IsOptional()
  @IsMongoId()
  linkReferenceId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
