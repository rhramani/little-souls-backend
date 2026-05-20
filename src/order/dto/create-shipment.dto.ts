import { IsString, IsOptional, IsNumber, IsUrl } from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  courierName: string;

  @IsString()
  trackingNumber: string;

  @IsOptional()
  @IsUrl()
  trackingUrl?: string;

  @IsOptional()
  @IsString()
  shippingProvider?: string;

  @IsOptional()
  @IsNumber()
  shippingCost?: number;
}
