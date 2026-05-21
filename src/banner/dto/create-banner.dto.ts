import { IsString, IsOptional, IsBoolean, IsIn, IsInt, IsUUID } from 'class-validator';

export class CreateBannerDto {
  @IsString()
  title: string;

  @IsIn(['HERO', 'CATEGORY', 'PROMO', 'WEB_HEADER', 'MOBILE'])
  bannerType: string;

  @IsString()
  imageUrl: string;

  @IsIn(['CATEGORY', 'PRODUCT', 'CUSTOM', 'NONE'])
  linkType: string;

  @IsOptional()
  @IsUUID()
  linkReferenceId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
