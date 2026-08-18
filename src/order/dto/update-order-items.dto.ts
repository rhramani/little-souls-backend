import {
  IsArray,
  IsNumber,
  IsString,
  ValidateNested,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class UpdateOrderItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items: UpdateOrderItemDto[];

  @IsNumber()
  @IsOptional()
  discountTotal?: number;

  @IsNumber()
  @IsOptional()
  taxPercent?: number;

  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @IsNumber()
  @IsOptional()
  packingCharges?: number;

  @IsString()
  @IsOptional()
  packingCtnNote?: string;

  @IsNumber()
  @IsOptional()
  otherCharges?: number;

  @IsString()
  @IsOptional()
  otherChargesNote?: string;

  @IsNumber()
  @IsOptional()
  otherDeduction?: number;

  @IsString()
  @IsOptional()
  otherDeductionNote?: string;

  @IsString()
  @IsOptional()
  discountType?: string;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;
}
