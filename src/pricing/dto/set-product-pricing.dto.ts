import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsInt,
} from 'class-validator';

export class SetProductPricingDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @IsMongoId()
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
