import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class PosOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class PosCheckoutDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  walkInName?: string;

  @IsString()
  @IsOptional()
  walkInMobile?: string;

  @IsString()
  @IsOptional()
  walkInGstin?: string;

  @IsString()
  @IsOptional()
  walkInPricingGroupId?: string;

  @IsString()
  @IsOptional()
  transportName?: string;

  @IsString()
  @IsOptional()
  ctn?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items: PosOrderItemDto[];

  @IsString()
  @IsOptional()
  paymentMethod?: string = 'CASH';

  @IsNumber()
  @IsOptional()
  discountTotal?: number = 0;

  @IsString()
  @IsOptional()
  discountType?: string;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsNumber()
  @IsOptional()
  otherDeduction?: number;

  @IsString()
  @IsOptional()
  otherDeductionNote?: string;

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
  taxPercent?: number;

  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @IsOptional()
  withGst?: boolean;
}
