import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  billingAddressLine1?: string;

  @IsOptional()
  @IsString()
  billingAddressLine2?: string;

  @IsOptional()
  @IsString()
  billingCity?: string;

  @IsOptional()
  @IsString()
  billingState?: string;

  @IsOptional()
  @IsString()
  billingPincode?: string;

  @IsOptional()
  @IsString()
  billingCountry?: string;

  @IsOptional()
  @IsString()
  shippingAddressLine1?: string;

  @IsOptional()
  @IsString()
  shippingAddressLine2?: string;

  @IsOptional()
  @IsString()
  shippingCity?: string;

  @IsOptional()
  @IsString()
  shippingState?: string;

  @IsOptional()
  @IsString()
  shippingPincode?: string;

  @IsOptional()
  @IsString()
  shippingCountry?: string;

  @IsOptional()
  @IsString()
  storePhotoUrl?: string;

  @IsOptional()
  @IsString()
  customerSource?: string;

  @IsOptional()
  @IsString()
  mainContactNumber?: string;

  @IsOptional()
  @IsString()
  pricingGroupId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  creditLimit?: string | number | null;

  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsString()
  @IsOptional()
  customerCode?: string;
}
