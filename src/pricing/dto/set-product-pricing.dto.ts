import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
} from 'class-validator';

export class SetProductPricingDto {
  @IsUUID('4')
  @IsNotEmpty()
  productId: string;

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
