import { IsString, IsOptional, IsArray, IsNumber, IsBoolean } from 'class-validator';

export class CheckoutDto {
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  billingAddress?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  orderSource?: string = 'WEBSITE';

  @IsString()
  @IsOptional()
  shippingCharge?: string = '0';

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsArray()
  @IsOptional()
  items?: any[];

  @IsNumber()
  @IsOptional()
  subTotal?: number;

  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @IsNumber()
  @IsOptional()
  taxPercent?: number;

  @IsNumber()
  @IsOptional()
  totalAmount?: number;

  @IsBoolean()
  @IsOptional()
  withGst?: boolean;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

