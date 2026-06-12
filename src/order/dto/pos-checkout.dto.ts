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

  @IsNumber()
  @IsOptional()
  taxPercent?: number;
}
