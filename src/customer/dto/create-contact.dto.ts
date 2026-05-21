import { IsString, IsOptional, IsBoolean, IsEmail } from 'class-validator';

export class CreateContactDto {
  @IsString()
  name: string;

  @IsString()
  mobile: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsBoolean()
  loginAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canPlaceOrder?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewLedger?: boolean;

  @IsOptional()
  @IsBoolean()
  canDownloadInvoice?: boolean;
}
