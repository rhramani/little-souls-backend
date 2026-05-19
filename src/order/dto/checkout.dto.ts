import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CheckoutDto {
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  orderSource?: string = 'WEBSITE';

  @IsString()
  @IsOptional()
  shippingCharge?: string = '0';
}
