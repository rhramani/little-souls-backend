import { IsString, IsOptional, IsUUID, IsInt, IsBoolean, IsDateString, IsEnum, ValidateNested, IsArray, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { StockStatus } from '@prisma/client';

class ProductImageUpdateDto {
  @IsString()
  @IsOptional()
  id?: string; // If exists, update; else create

  @IsString()
  @IsNotEmpty()
  originalUrl: string;

  @IsString()
  @IsOptional()
  altText?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

class ProductPricingUpdateDto {
  @IsUUID('4')
  @IsNotEmpty()
  pricingGroupId: string;

  @IsString()
  @IsNotEmpty()
  price: string;

  @IsString()
  @IsOptional()
  mrp?: string;

  @IsString()
  @IsOptional()
  discountPercent?: string;

  @IsInt()
  @IsOptional()
  minQuantity?: number;

  @IsInt()
  @IsOptional()
  maxQuantity?: number;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @IsInt()
  @IsOptional()
  moq?: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  material?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  hsnCode?: string;

  @IsOptional()
  weight?: number;

  @IsOptional()
  taxPercent?: number;

  @IsInt()
  @IsOptional()
  stockQuantity?: number;

  @IsEnum(StockStatus)
  @IsOptional()
  stockStatus?: StockStatus;

  @IsBoolean()
  @IsOptional()
  allowBackorder?: boolean;

  @IsDateString()
  @IsOptional()
  expectedRestockDate?: string;

  @IsString()
  @IsOptional()
  tags?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageUpdateDto)
  @IsOptional()
  images?: ProductImageUpdateDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPricingUpdateDto)
  @IsOptional()
  pricing?: ProductPricingUpdateDto[];
}
