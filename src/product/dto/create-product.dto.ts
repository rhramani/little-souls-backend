import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsInt,
  IsBoolean,
  IsDecimal,
  IsDateString,
  IsEnum,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StockStatus } from '@prisma/client';
import { IsR2Url } from '../../upload/decorators/is-r2-url.decorator';

class ProductImageDto {
  @IsString()
  @IsNotEmpty()
  @IsR2Url()
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

class ProductPricingDto {
  @IsMongoId()
  @IsNotEmpty()
  pricingGroupId: string;

  @IsString()
  @IsNotEmpty()
  price: string; // Keep as string to avoid floating point issues during transport, parsed in service

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

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @IsMongoId()
  @IsOptional()
  catalogueId?: string;

  @IsInt()
  @IsOptional()
  moq?: number;

  @IsInt()
  @IsOptional()
  wholesalerMoq?: number;

  @IsInt()
  @IsOptional()
  fixQty?: number;

  @IsString()
  @IsOptional()
  barcode?: string;

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

  @IsString()
  @IsOptional()
  productImage?: string;

  @IsString()
  @IsOptional()
  productPictureUrl?: string;

  @IsOptional()
  productPrice?: number;

  @IsOptional()
  discountedPrice?: number;

  @IsString()
  @IsOptional()
  taxType?: string;

  @IsString()
  @IsOptional()
  parentProductSku?: string;

  @IsString()
  @IsOptional()
  parentProductId?: string;

  @IsString()
  @IsOptional()
  privateNotes?: string;



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
  @Type(() => ProductImageDto)
  @IsOptional()
  images?: ProductImageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPricingDto)
  @IsOptional()
  pricing?: ProductPricingDto[];
}
