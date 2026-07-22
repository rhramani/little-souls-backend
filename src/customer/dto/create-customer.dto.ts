import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Mobile number must be at least 10 digits' })
  mobile: string;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsOptional()
  businessType?: string;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  billingAddressLine1?: string;

  @IsString()
  @IsOptional()
  billingAddressLine2?: string;

  @IsString()
  @IsOptional()
  billingCity?: string;

  @IsString()
  @IsOptional()
  billingState?: string;

  @IsString()
  @IsOptional()
  billingPincode?: string;

  @IsString()
  @IsOptional()
  billingCountry?: string;

  @IsString()
  @IsOptional()
  shippingAddressLine1?: string;

  @IsString()
  @IsOptional()
  shippingAddressLine2?: string;

  @IsString()
  @IsOptional()
  shippingCity?: string;

  @IsString()
  @IsOptional()
  shippingState?: string;

  @IsString()
  @IsOptional()
  shippingPincode?: string;

  @IsString()
  @IsOptional()
  shippingCountry?: string;

  @IsString()
  @IsOptional()
  storePhotoUrl?: string;

  @IsString()
  @IsOptional()
  customerSource?: string;

  @IsString()
  @IsOptional()
  pricingGroupId?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsOptional()
  creditLimit?: string | number | null;

  @IsString()
  @IsOptional()
  customerCode?: string;
}
