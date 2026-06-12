import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsInt,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessLogoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  companyAddress?: string;

  @IsOptional()
  @IsString()
  whatsappOrderNumber?: string;

  @IsOptional()
  @IsString()
  orderPrefix?: string;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  paymentPrefix?: string;

  @IsOptional()
  @IsString()
  purchaseOrderPrefix?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  defaultTaxPercent?: number;

  @IsOptional()
  @IsInt()
  lowStockThreshold?: number;
}
